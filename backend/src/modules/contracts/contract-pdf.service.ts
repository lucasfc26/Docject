import { Injectable } from "@nestjs/common";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PrismaService } from "../../prisma/prisma.service";
import { listContractParticipants, participantSignLabel } from "./contracts.helpers";

const uploadPrefix = "/uploads/contracts/";

@Injectable()
export class ContractPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSignedPdf(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        versions: true,
        createdBy: true,
        participants: {
          orderBy: [{ role: "asc" }, { witnessIndex: "asc" }, { addedAt: "asc" }],
          include: { user: true, addedBy: true },
        },
        eventLogs: { orderBy: { createdAt: "asc" } },
        signatureLogs: { orderBy: { signedAt: "asc" } },
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
      participants: listContractParticipants(contract.participants),
      eventLogs: contract.eventLogs,
      signatureLogs: contract.signatureLogs,
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
        createdBy: { select: { id: true, name: true, email: true } },
        participants: {
          orderBy: [{ role: "asc" }, { witnessIndex: "asc" }, { addedAt: "asc" }],
          include: {
            user: { select: { id: true, name: true, email: true, role: true, cpf: true } },
            addedBy: { select: { id: true, name: true, email: true } },
          },
        },
        eventLogs: { orderBy: { createdAt: "asc" } },
        signatureLogs: { orderBy: { signedAt: "asc" } },
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
    participants: Array<{
      role: string;
      witnessIndex?: number | null;
      signedAt?: Date | null;
      user?: { name: string; email: string; cpf?: string | null } | null;
    }>;
    eventLogs: Array<{
      description: string;
      createdAt: Date;
      actorName?: string | null;
      actorEmail?: string | null;
    }>;
    signatureLogs: Array<{
      role: string;
      signerName: string;
      signerEmail?: string | null;
      signerCpf?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      geoAccuracy?: number | null;
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

  line(`${data.title}`, 14, bold);
  line(`Documento numero #${data.contractId}`, 11, bold);
  line(`Hash do documento original (SHA256): ${data.originalDocumentHash}`);
  cursor -= 8;

  line("Assinaturas", 13, bold);
  for (const participant of data.participants) {
    if (!participant.signedAt || !participant.user) continue;
    line(participant.user.name, 11, bold);
    line(`CPF: ${participant.user.cpf ?? "-"}`);
    line(`${participantSignLabel(participant.role, participant.witnessIndex)} em ${formatBrDateTime(participant.signedAt)}`);
    cursor -= 4;
  }

  cursor -= 8;
  line("Log", 13, bold);
  line("Datas e horarios em UTC", 9);
  for (const event of data.eventLogs) {
    line(`${formatBrDateTime(event.createdAt)} ${event.description}`, 9);
    cursor -= 2;
  }

  cursor -= 8;
  line("Detalhes tecnicos das assinaturas", 13, bold);
  for (const log of data.signatureLogs) {
    line(`${log.role} | ${log.signerName} | ${formatUtcDate(log.signedAt)}`, 10, bold);
    line(`Email: ${log.signerEmail ?? "-"} | CPF: ${log.signerCpf ?? "-"} | IP: ${log.ipAddress ?? "-"}`);
    line(`User-Agent: ${truncate(log.userAgent, 90) ?? "-"}`);
    line(`Token SHA-256: ${log.tokenHash ?? "-"}`);
    line(`Hash documento no momento da assinatura: ${log.documentHash ?? "-"}`);
    if (log.latitude != null && log.longitude != null) {
      line(`Geolocalizacao: ${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)} (precisao ~${Math.round(log.geoAccuracy ?? 0)}m)`);
    }
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

function formatBrDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "America/Fortaleza",
  }).format(value);
}

function formatUtcDate(value: Date) {
  return `${value.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function truncate(value?: string | null, max = 115) {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
