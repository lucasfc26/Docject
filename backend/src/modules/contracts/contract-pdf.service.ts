import { Injectable } from "@nestjs/common";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PrismaService } from "../../prisma/prisma.service";

const uploadPrefix = "/uploads/contracts/";

@Injectable()
export class ContractPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSignedPdf(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        versions: true,
        signatureLogs: { orderBy: { signedAt: "asc" as const } },
        contractingParty: true,
        contractor: true,
        witnessOne: true,
        witnessTwo: true,
      },
    });
    if (!contract) throw new Error("Contrato nao encontrado.");

    const sourceVersion = [...contract.versions]
      .sort((a, b) => b.version - a.version)
      .find((version) => version.fileUrl && version.fileUrl !== contract.signedFileUrl);
    if (!sourceVersion?.fileUrl) throw new Error("Contrato sem PDF original.");

    const sourcePath = uploadedContractPath(sourceVersion.fileUrl);
    const sourceBytes = await readFile(sourcePath);
    const originalDocumentHash = sha256(sourceBytes);
    const validationCode = randomValidationCode();
    const pdf = await PDFDocument.load(sourceBytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    addSignatureLogPages(pdf, font, bold, {
      contractId: contract.id,
      title: contract.title,
      originalDocumentHash,
      validationCode,
      participants: [
        { role: "Contratante", user: contract.contractingParty, signedAt: contract.contractingPartySignedAt },
        { role: "Contratado", user: contract.contractor, signedAt: contract.contractorSignedAt },
        { role: "Testemunha 1", user: contract.witnessOne, signedAt: contract.witnessOneSignedAt },
        { role: "Testemunha 2", user: contract.witnessTwo, signedAt: contract.witnessTwoSignedAt },
      ],
      logs: contract.signatureLogs,
    });

    const signedBytes = await pdf.save();
    const signedDocumentHash = sha256(Buffer.from(signedBytes));
    await mkdir(join(process.cwd(), "uploads", "contracts"), { recursive: true });
    const filename = `${contract.id}-signed-${Date.now()}.pdf`;
    const filePath = join(process.cwd(), "uploads", "contracts", filename);
    await writeFile(filePath, signedBytes);
    const signedFileUrl = `${uploadPrefix}${filename}`;
    const nextVersion = (contract.versions.reduce((max, version) => Math.max(max, version.version), 0) || 0) + 1;

    return this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: "SIGNED",
        originalDocumentHash,
        signedDocumentHash,
        signedFileUrl,
        validationCodeHash: sha256(normalizeValidationCode(validationCode)),
        versions: {
          create: {
            version: nextVersion,
            fileUrl: signedFileUrl,
          },
        },
      },
      include: {
        versions: true,
        client: true,
        signatureLogs: { orderBy: { signedAt: "asc" as const } },
        contractingParty: { select: { id: true, name: true, email: true, role: true, cpf: true } },
        contractor: { select: { id: true, name: true, email: true, role: true, cpf: true } },
        witnessOne: { select: { id: true, name: true, email: true, role: true, cpf: true } },
        witnessTwo: { select: { id: true, name: true, email: true, role: true, cpf: true } },
      },
    });
  }
}

function addSignatureLogPages(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  data: {
    contractId: string;
    title: string;
    originalDocumentHash: string;
    validationCode: string;
    participants: Array<{ role: string; user: { name: string; email: string; cpf?: string | null } | null; signedAt?: Date | null }>;
    logs: Array<{
      role: string;
      signerName: string;
      signerEmail?: string | null;
      signerCpf?: string | null;
      ipAddress?: string | null;
      tokenHash?: string | null;
      documentHash?: string | null;
      signedAt: Date;
    }>;
  },
) {
  let page = pdf.addPage();
  let cursor = page.getHeight() - 56;
  const margin = 44;
  const line = (text: string, size = 10, activeFont = font) => {
    if (cursor < 64) {
      page = pdf.addPage();
      cursor = page.getHeight() - 56;
    }
    page.drawText(text.slice(0, 115), { x: margin, y: cursor, size, font: activeFont, color: rgb(0.1, 0.12, 0.16) });
    cursor -= size + 8;
  };

  line("Registro de assinaturas Docject", 16, bold);
  line(`Contrato: ${data.title}`, 11, bold);
  line(`UUID: ${data.contractId}`);
  line(`Hash SHA-256 do documento original: ${data.originalDocumentHash}`);
  cursor -= 8;
  line("Participantes", 13, bold);
  for (const participant of data.participants) {
    line(`${participant.role}: ${participant.user?.name ?? "Nao vinculado"} | CPF: ${participant.user?.cpf ?? "-"} | ${participant.signedAt ? `Assinado em ${formatDate(participant.signedAt)}` : "Pendente"}`);
  }

  cursor -= 8;
  line("Logs de assinatura", 13, bold);
  for (const log of data.logs) {
    line(`${log.role} | ${log.signerName} | CPF: ${log.signerCpf ?? "-"} | ${formatDate(log.signedAt)}`, 10, bold);
    line(`Email: ${log.signerEmail ?? "-"} | IP: ${log.ipAddress ?? "-"}`);
    line(`Token SHA-256: ${log.tokenHash ?? "-"}`);
    line(`Hash documento no momento da assinatura: ${log.documentHash ?? "-"}`);
    cursor -= 4;
  }

  cursor -= 8;
  line("Validacao publica", 13, bold);
  line(`Senha de validacao: ${data.validationCode}`, 12, bold);
  line("Use esta senha na pagina /validar-contrato para visualizar o contrato assinado.");

  const pages = pdf.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    const { width } = current.getSize();
    const footer = `Docject | Contrato ${data.contractId} | Pagina ${index + 1}/${pages.length}`;
    current.drawText(footer, { x: 36, y: 18, size: 8, font, color: rgb(0.28, 0.31, 0.36) });
    current.drawLine({
      start: { x: 36, y: 32 },
      end: { x: width - 36, y: 32 },
      thickness: 0.4,
      color: rgb(0.78, 0.8, 0.84),
    });
  }
}

function uploadedContractPath(fileUrl: string) {
  const pathname = fileUrl.startsWith("http") ? new URL(fileUrl).pathname : fileUrl;
  if (!pathname.startsWith(uploadPrefix)) throw new Error("Arquivo fora da pasta de contratos.");
  return join(process.cwd(), "uploads", "contracts", basename(pathname));
}

function sha256(value: Buffer | Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function randomValidationCode() {
  const raw = randomBytes(9).toString("hex").toUpperCase();
  return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
}

function normalizeValidationCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Fortaleza",
  }).format(value);
}
