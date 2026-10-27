import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AsaasCredential } from "@prisma/client";
import { randomBytes } from "crypto";
import {
  AsaasBillingType,
  AsaasClient,
  AsaasFiscalInvoice,
  AsaasPayment,
  PAID_PAYMENT_STATUSES,
  asaasDueDate,
  asaasEnvironment,
  onlyDigits,
} from "../../common/asaas/asaas.client";
import { CurrentUser } from "../../common/current-user";
import { resolveResponsibleAdminId } from "../../common/responsible-admin";
import { decryptSecret, encryptSecret } from "../../common/secret-box";
import { webhookTokenMatches } from "../../common/webhook-token";
import { PrismaService } from "../../prisma/prisma.service";
import {
  InvoiceClient,
  InvoiceTransaction,
  asaasCustomerData,
  clientDocument,
  formatClientAddress,
  invoiceDescription,
  invoiceKind,
  invoiceLine,
  transactionClient,
  transactionInclude,
  transactionOwnerId,
} from "./billing.invoice";
import { SaveAsaasCredentialDto } from "./dto/billing.dto";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async credential(adminId: string) {
    const credential = await this.prisma.asaasCredential.findUnique({ where: { userId: adminId } });
    return this.present(credential);
  }

  /** Validates the key against Asaas before storing it encrypted. */
  async saveCredential(adminId: string, body: SaveAsaasCredentialDto) {
    const current = await this.prisma.asaasCredential.findUnique({ where: { userId: adminId } });
    const apiKey = body.apiKey?.trim() || (current ? decryptSecret(current.apiKeyEncrypted) : "");
    if (!apiKey) throw new BadRequestException("Informe a chave de API do Asaas.");

    const environment = asaasEnvironment(body.environment);
    await new AsaasClient(apiKey, environment).balance();

    const keyChanged =
      !current || current.environment !== environment || decryptSecret(current.apiKeyEncrypted) !== apiKey;
    const webhookToken =
      body.webhookToken === undefined
        ? undefined
        : body.webhookToken.trim()
          ? encryptSecret(body.webhookToken.trim())
          : null;

    const data = {
      environment,
      apiKeyEncrypted: encryptSecret(apiKey),
      apiKeyLast4: apiKey.slice(-4),
      webhookTokenEncrypted: webhookToken,
      autoCharge: body.autoCharge,
      defaultBillingType: body.defaultBillingType,
      chargeDaysBefore: body.chargeDaysBefore,
      nfseEnabled: body.nfseEnabled,
      nfseServiceCode: body.nfseServiceCode?.trim() || null,
      nfseServiceName: body.nfseServiceName?.trim() || null,
      nfseIssRate: body.nfseIssRate,
      nfseRetainIss: body.nfseRetainIss,
      nfseObservations: body.nfseObservations?.trim() || null,
    };
    if (data.nfseEnabled && (!data.nfseServiceCode || !data.nfseServiceName)) {
      throw new BadRequestException("Informe o codigo e o nome do servico municipal para emitir notas fiscais.");
    }
    const saved = await this.prisma.asaasCredential.upsert({
      where: { userId: adminId },
      update: data,
      create: {
        ...data,
        userId: adminId,
        webhookTokenEncrypted: webhookToken ?? encryptSecret(randomBytes(24).toString("hex")),
      },
    });

    // Customers live inside one Asaas account, so a new account starts without them.
    if (keyChanged) {
      await this.prisma.client.updateMany({ where: { ownerId: adminId }, data: { asaasCustomerId: null } });
    }
    return this.present(saved);
  }

  async removeCredential(adminId: string) {
    await this.prisma.asaasCredential.deleteMany({ where: { userId: adminId } });
    await this.prisma.client.updateMany({ where: { ownerId: adminId }, data: { asaasCustomerId: null } });
    return this.present(null);
  }

  async revealWebhookToken(adminId: string) {
    const credential = await this.requireCredential(adminId);
    return { webhookToken: credential.webhookTokenEncrypted ? decryptSecret(credential.webhookTokenEncrypted) : null };
  }

  async testCredential(adminId: string) {
    const credential = await this.requireCredential(adminId);
    const { balance } = await this.client(credential).balance();
    return { ok: true, balance };
  }

  /** Issues (or reissues with another billing type) the Asaas charge of a revenue entry. */
  async charge(adminId: string, transactionId: string, billingType: AsaasBillingType) {
    const credential = await this.requireCredential(adminId);
    const transaction = await this.ownedTransaction(adminId, transactionId);
    return this.issueCharge(credential, transaction, billingType);
  }

  async cancelCharge(adminId: string, transactionId: string) {
    const credential = await this.requireCredential(adminId);
    const transaction = await this.ownedTransaction(adminId, transactionId);
    if (!transaction.asaasPaymentId) return transaction;
    await this.client(credential).deletePayment(transaction.asaasPaymentId);
    return this.prisma.financialTransaction.update({
      where: { id: transaction.id },
      data: clearedCharge,
    });
  }

  async syncCharge(adminId: string, transactionId: string) {
    const credential = await this.requireCredential(adminId);
    const transaction = await this.ownedTransaction(adminId, transactionId);
    if (!transaction.asaasPaymentId) return transaction;
    const asaas = this.client(credential);
    if (transaction.nfseId) {
      const fiscal = await asaas.getFiscalInvoice(transaction.nfseId).catch(() => null);
      if (fiscal) await this.applyFiscalInvoice(transaction.id, fiscal);
    }
    const payment = await asaas.getPayment(transaction.asaasPaymentId);
    return this.applyPayment(credential, transaction.id, payment);
  }

  /** Issues (or retries) the NFS-e of a paid entry by hand. */
  async emitNfse(adminId: string, transactionId: string) {
    const credential = await this.requireCredential(adminId);
    if (!credential.nfseEnabled) {
      throw new BadRequestException("Ative a emissao de notas fiscais em Configuracoes > Banco.");
    }
    const transaction = await this.ownedTransaction(adminId, transactionId);
    if (transaction.status !== "PAID") throw new BadRequestException("A nota fiscal e emitida apos o pagamento.");
    await this.issueNfse(credential, transaction.id, true);
    return this.prisma.financialTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
  }

  /** Webhook of an admin's own Asaas account: payment events and NFS-e events. */
  async handleWebhook(
    credentialId: string,
    token: unknown,
    body: { event?: string; payment?: AsaasPayment; invoice?: AsaasFiscalInvoice },
  ) {
    const credential = await this.prisma.asaasCredential.findUnique({ where: { id: credentialId } });
    const expected = credential?.webhookTokenEncrypted ? decryptSecret(credential.webhookTokenEncrypted) : null;
    if (!credential || !webhookTokenMatches(token, expected)) throw new ForbiddenException();
    const { event, payment, invoice } = body;

    if (event?.startsWith("INVOICE_") && invoice?.id) {
      const target = await this.prisma.financialTransaction.findFirst({
        where: {
          OR: [{ nfseId: invoice.id }, ...(invoice.externalReference ? [{ id: invoice.externalReference }] : [])],
        },
        include: transactionInclude,
      });
      const targetOwner = target ? transactionOwnerId(target) : null;
      if (!target || (targetOwner && targetOwner !== credential.userId)) return { ok: true, ignored: true };
      await this.applyFiscalInvoice(target.id, invoice);
      return { ok: true };
    }

    if (!event || !payment?.id) return { ok: true, ignored: true };

    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { asaasPaymentId: payment.id },
      include: transactionInclude,
    });
    const ownerId = transaction ? transactionOwnerId(transaction) : null;
    if (!transaction || (ownerId && ownerId !== credential.userId)) return { ok: true, ignored: true };

    if (event === "PAYMENT_DELETED") {
      await this.prisma.financialTransaction.update({ where: { id: transaction.id }, data: clearedCharge });
    } else {
      await this.applyPayment(credential, transaction.id, payment);
    }
    return { ok: true };
  }

  /** Creates the charges that fall inside the "days before due date" window of each admin. */
  async runAutoCharge() {
    const credentials = await this.prisma.asaasCredential.findMany({ where: { autoCharge: true } });
    for (const credential of credentials) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date(today);
      limit.setDate(limit.getDate() + credential.chargeDaysBefore);
      limit.setHours(23, 59, 59, 999);
      const owned = { client: { ownerId: credential.userId } };
      const transactions = await this.prisma.financialTransaction.findMany({
        where: {
          kind: "REVENUE",
          status: "PENDING",
          asaasPaymentId: null,
          dueDate: { gte: today, lte: limit },
          OR: [{ module: { project: owned } }, { service: owned }],
        },
        include: transactionInclude,
      });
      for (const transaction of transactions) {
        try {
          await this.issueCharge(credential, transaction, credential.defaultBillingType as AsaasBillingType);
        } catch (error) {
          this.logger.warn(`Cobranca automatica falhou para ${transaction.id}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
  }

  /**
   * Issues (or reissues) the invoice of a revenue entry. BOLETO payments also carry a Pix
   * QR code, so the invoice offers both options; the slip line and the QR code are stored.
   */
  private async issueCharge(credential: AsaasCredential, transaction: InvoiceTransaction, billingType: AsaasBillingType) {
    if (transaction.kind !== "REVENUE") throw new BadRequestException("Somente receitas podem ser cobradas.");
    if (transaction.status === "PAID" || transaction.status === "CANCELLED") {
      throw new BadRequestException("Este lancamento ja esta pago ou cancelado.");
    }
    const client = transactionClient(transaction);
    if (!client) throw new BadRequestException("Vincule o lancamento a um projeto ou servico de um cliente para cobrar.");

    const asaas = this.client(credential);
    if (transaction.asaasPaymentId) {
      if (transaction.asaasBillingType === billingType) return transaction;
      await asaas.deletePayment(transaction.asaasPaymentId).catch(() => undefined);
    }

    const customerId = await this.syncCustomer(asaas, client);
    const description = invoiceDescription(transaction);
    const payment = await asaas.createPayment({
      customer: customerId,
      billingType,
      value: Math.abs(Number(transaction.amount)),
      dueDate: asaasDueDate(transaction.dueDate),
      description,
      externalReference: transaction.id,
    });
    const [pix, slip] = await Promise.all([
      billingType === "PIX" || billingType === "BOLETO" ? asaas.pixQrCode(payment.id).catch(() => null) : null,
      billingType === "BOLETO" ? asaas.identificationField(payment.id).catch(() => null) : null,
    ]);

    return this.prisma.financialTransaction.update({
      where: { id: transaction.id },
      data: {
        asaasPaymentId: payment.id,
        asaasBillingType: billingType,
        asaasInvoiceUrl: payment.invoiceUrl ?? null,
        asaasInvoiceNumber: payment.invoiceNumber ?? null,
        asaasBankSlipUrl: payment.bankSlipUrl ?? null,
        asaasIdentificationField: slip?.identificationField ?? null,
        asaasBarCode: slip?.barCode ?? null,
        asaasNossoNumero: slip?.nossoNumero ?? null,
        asaasPixPayload: pix?.payload ?? null,
        asaasPixQrImage: pix?.encodedImage ?? null,
        asaasStatus: payment.status,
        invoiceDescription: description,
        invoiceIssuedAt: new Date(),
      },
    });
  }

  /** Creates the Asaas customer once and refreshes name, document and address on every invoice. */
  private async syncCustomer(asaas: AsaasClient, client: InvoiceClient) {
    const document = clientDocument(client);
    if (document.length !== 11 && document.length !== 14) {
      throw new BadRequestException(`Cadastre o CPF ou CNPJ do cliente ${client.name} para emitir a fatura.`);
    }
    const data = asaasCustomerData(client);
    if (client.asaasCustomerId) {
      await asaas.updateCustomer(client.asaasCustomerId, data).catch((error) =>
        this.logger.warn(`Falha ao atualizar cliente Asaas ${client.asaasCustomerId}: ${error}`),
      );
      return client.asaasCustomerId;
    }
    const customer = await asaas.createCustomer(data);
    await this.prisma.client.update({ where: { id: client.id }, data: { asaasCustomerId: customer.id } });
    return customer.id;
  }

  /** Revenue entries of the client's company, newest first. */
  async clientInvoices(user: CurrentUser) {
    const ofUser = { client: { users: { some: { id: user.sub } } } };
    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        kind: "REVENUE",
        status: { not: "CANCELLED" },
        OR: [{ module: { project: ofUser } }, { service: ofUser }],
      },
      include: transactionInclude,
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    });
    return transactions.map((transaction) => this.invoiceSummary(transaction));
  }

  /** Full invoice for the client it belongs to or for the staff of the owner admin. */
  async invoice(user: CurrentUser, transactionId: string) {
    let transaction = await this.prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      include: transactionInclude,
    });
    if (!transaction || transaction.kind !== "REVENUE") throw new NotFoundException("Fatura nao encontrada.");
    const client = transactionClient(transaction);
    const ownerId = transactionOwnerId(transaction);

    if (user.role === "CLIENT") {
      if (!client?.users.some((item) => item.id === user.sub)) throw new NotFoundException("Fatura nao encontrada.");
    } else {
      const adminId = await resolveResponsibleAdminId(this.prisma, user.sub);
      if (ownerId && ownerId !== adminId) throw new ForbiddenException();
    }

    if (transaction.asaasPaymentId && ownerId && !transaction.asaasPixQrImage && !transaction.asaasIdentificationField) {
      transaction = await this.refreshPaymentData(ownerId, transaction);
    }

    const owner = ownerId
      ? await this.prisma.user.findUnique({
          where: { id: ownerId },
          select: { name: true, email: true, phone: true, cpf: true, logoUrl: true, subscription: { select: { cpfCnpj: true } } },
        })
      : null;

    return {
      ...this.invoiceSummary(transaction),
      line: invoiceLine(transaction),
      customer: client
        ? {
            name: client.name,
            document: clientDocument(client) || null,
            address: formatClientAddress(client),
            contact:
              client.email ?? client.contacts[0]?.email ?? client.contacts[0]?.phone ?? client.users[0]?.email ?? null,
          }
        : null,
      issuer: owner
        ? {
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
            logoUrl: owner.logoUrl,
            document: onlyDigits(owner.subscription?.cpfCnpj) || onlyDigits(owner.cpf) || null,
          }
        : null,
      pix: transaction.asaasPixPayload
        ? { payload: transaction.asaasPixPayload, qrImage: transaction.asaasPixQrImage }
        : null,
      boleto:
        transaction.asaasIdentificationField || transaction.asaasBankSlipUrl
          ? {
              identificationField: transaction.asaasIdentificationField,
              barCode: transaction.asaasBarCode,
              nossoNumero: transaction.asaasNossoNumero,
              url: transaction.asaasBankSlipUrl,
            }
          : null,
      invoiceUrl: transaction.asaasInvoiceUrl,
      nfse: transaction.nfseId
        ? {
            status: transaction.nfseStatus,
            number: transaction.nfseNumber,
            pdfUrl: transaction.nfsePdfUrl,
            xmlUrl: transaction.nfseXmlUrl,
          }
        : null,
    };
  }

  private invoiceSummary(transaction: InvoiceTransaction) {
    return {
      id: transaction.id,
      number: transaction.asaasInvoiceNumber ?? transaction.id.slice(0, 8).toUpperCase(),
      kind: invoiceKind(transaction),
      description: transaction.invoiceDescription ?? invoiceDescription(transaction),
      amount: Math.abs(Number(transaction.amount)),
      dueDate: transaction.dueDate,
      status: transaction.status,
      issued: Boolean(transaction.asaasPaymentId),
      issuedAt: transaction.invoiceIssuedAt,
      hasPix: Boolean(transaction.asaasPixPayload),
      hasBoleto: Boolean(transaction.asaasIdentificationField || transaction.asaasBankSlipUrl),
      nfsePdfUrl: transaction.nfseStatus === "AUTHORIZED" ? transaction.nfsePdfUrl : null,
    };
  }

  /** Loads the slip line and Pix QR code of invoices issued before they were stored. */
  private async refreshPaymentData(ownerId: string, transaction: InvoiceTransaction) {
    const credential = await this.prisma.asaasCredential.findUnique({ where: { userId: ownerId } });
    if (!credential || !transaction.asaasPaymentId) return transaction;
    const asaas = this.client(credential);
    const [pix, slip] = await Promise.all([
      asaas.pixQrCode(transaction.asaasPaymentId).catch(() => null),
      transaction.asaasBillingType === "BOLETO"
        ? asaas.identificationField(transaction.asaasPaymentId).catch(() => null)
        : null,
    ]);
    if (!pix && !slip) return transaction;
    return this.prisma.financialTransaction.update({
      where: { id: transaction.id },
      data: {
        asaasPixPayload: pix?.payload ?? transaction.asaasPixPayload,
        asaasPixQrImage: pix?.encodedImage ?? null,
        asaasIdentificationField: slip?.identificationField ?? null,
        asaasBarCode: slip?.barCode ?? null,
        asaasNossoNumero: slip?.nossoNumero ?? null,
      },
      include: transactionInclude,
    });
  }

  private async applyPayment(credential: AsaasCredential, transactionId: string, payment: AsaasPayment) {
    const status = PAID_PAYMENT_STATUSES.has(payment.status)
      ? "PAID"
      : payment.status === "OVERDUE"
        ? "OVERDUE"
        : undefined;
    const saved = await this.prisma.financialTransaction.update({
      where: { id: transactionId },
      data: {
        status,
        asaasStatus: payment.status,
        asaasInvoiceUrl: payment.invoiceUrl ?? undefined,
        asaasBankSlipUrl: payment.bankSlipUrl ?? undefined,
      },
    });
    if (status === "PAID" && credential.nfseEnabled && !saved.nfseId) {
      await this.issueNfse(credential, saved.id, false);
      return this.prisma.financialTransaction.findUniqueOrThrow({ where: { id: saved.id } });
    }
    return saved;
  }

  /**
   * Schedules the NFS-e of a paid charge for today. Failures are stored on the entry (and
   * shown in the UI) instead of thrown, so the Asaas webhook queue never stalls.
   */
  private async issueNfse(credential: AsaasCredential, transactionId: string, rethrow: boolean) {
    const transaction = await this.prisma.financialTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: transactionInclude,
    });
    if (transaction.nfseId && transaction.nfseStatus !== "ERROR" && transaction.nfseStatus !== "CANCELED") return;
    try {
      if (!transaction.asaasPaymentId) {
        throw new BadRequestException("A nota fiscal so pode ser emitida para cobrancas feitas pelo Asaas.");
      }
      if (!credential.nfseServiceCode || !credential.nfseServiceName) {
        throw new BadRequestException("Configure o servico municipal em Configuracoes > Banco.");
      }
      const description = transaction.invoiceDescription ?? invoiceDescription(transaction);
      const fiscal = await this.client(credential).createFiscalInvoice({
        payment: transaction.asaasPaymentId,
        serviceDescription: description,
        observations: credential.nfseObservations || description,
        value: Math.abs(Number(transaction.amount)),
        deductions: 0,
        effectiveDate: asaasDueDate(),
        municipalServiceCode: credential.nfseServiceCode,
        municipalServiceName: credential.nfseServiceName,
        externalReference: transaction.id,
        taxes: { retainIss: credential.nfseRetainIss, iss: credential.nfseIssRate, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 },
      });
      await this.applyFiscalInvoice(transaction.id, fiscal);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao emitir a nota fiscal.";
      this.logger.warn(`NFS-e falhou para ${transaction.id}: ${message}`);
      await this.prisma.financialTransaction.update({
        where: { id: transaction.id },
        data: { nfseStatus: "ERROR", nfseError: message },
      });
      if (rethrow) throw error;
    }
  }

  private applyFiscalInvoice(transactionId: string, fiscal: AsaasFiscalInvoice) {
    return this.prisma.financialTransaction.update({
      where: { id: transactionId },
      data: {
        nfseId: fiscal.id,
        nfseStatus: fiscal.status,
        nfseNumber: fiscal.number ?? undefined,
        nfsePdfUrl: fiscal.pdfUrl ?? undefined,
        nfseXmlUrl: fiscal.xmlUrl ?? undefined,
        nfseError: fiscal.status === "ERROR" ? fiscal.statusDescription ?? "Erro na emissao da nota fiscal." : null,
      },
    });
  }

  private async ownedTransaction(adminId: string, transactionId: string) {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      include: transactionInclude,
    });
    if (!transaction) throw new NotFoundException("Lancamento nao encontrado.");
    const ownerId = transactionOwnerId(transaction);
    if (ownerId && ownerId !== adminId) throw new ForbiddenException();
    return transaction;
  }

  private async requireCredential(adminId: string) {
    const credential = await this.prisma.asaasCredential.findUnique({ where: { userId: adminId } });
    if (!credential) throw new BadRequestException("Cadastre sua chave do Asaas em Configuracoes > Banco.");
    return credential;
  }

  private client(credential: AsaasCredential) {
    return new AsaasClient(decryptSecret(credential.apiKeyEncrypted), asaasEnvironment(credential.environment));
  }

  private present(credential: AsaasCredential | null) {
    if (!credential) return { configured: false as const };
    const base = (process.env.API_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const apiBase = base.endsWith("/api") ? base : `${base}/api`;
    return {
      configured: true as const,
      environment: credential.environment,
      apiKeyMasked: `••••••••${credential.apiKeyLast4}`,
      hasWebhookToken: Boolean(credential.webhookTokenEncrypted),
      webhookUrl: `${apiBase}/billing/webhook/${credential.id}`,
      autoCharge: credential.autoCharge,
      defaultBillingType: credential.defaultBillingType,
      chargeDaysBefore: credential.chargeDaysBefore,
      nfseEnabled: credential.nfseEnabled,
      nfseServiceCode: credential.nfseServiceCode,
      nfseServiceName: credential.nfseServiceName,
      nfseIssRate: credential.nfseIssRate,
      nfseRetainIss: credential.nfseRetainIss,
      nfseObservations: credential.nfseObservations,
      updatedAt: credential.updatedAt,
    };
  }
}

const clearedCharge = {
  asaasPaymentId: null,
  asaasBillingType: null,
  asaasInvoiceUrl: null,
  asaasInvoiceNumber: null,
  asaasBankSlipUrl: null,
  asaasIdentificationField: null,
  asaasBarCode: null,
  asaasNossoNumero: null,
  asaasPixPayload: null,
  asaasPixQrImage: null,
  asaasStatus: null,
  invoiceDescription: null,
  invoiceIssuedAt: null,
};
