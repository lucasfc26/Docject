import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import * as bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { join } from "node:path";
import { Public } from "../../common/public.decorator";
import { AuthenticatedRequest, contractScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { ContractPdfService } from "./contract-pdf.service";
import { CreateContractDto, CreateContractVersionDto, SignContractDto, UpdateContractDto, ValidateContractDto } from "./dto/contract.dto";

const contractInclude = {
  versions: true,
  client: true,
  signatureLogs: { orderBy: { signedAt: "asc" } },
  contractingParty: { select: { id: true, name: true, email: true, role: true, cpf: true } },
  contractor: { select: { id: true, name: true, email: true, role: true, cpf: true } },
  witnessOne: { select: { id: true, name: true, email: true, role: true, cpf: true } },
  witnessTwo: { select: { id: true, name: true, email: true, role: true, cpf: true } }
} as const;

@ApiTags("contracts")
@Controller("contracts")
export class ContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: ContractPdfService
  ) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.prisma.contract.findMany({ where: contractScope(request.user), include: contractInclude, orderBy: { createdAt: "desc" } });
  }

  @Post()
  create(@Body() body: CreateContractDto) {
    return this.prisma.contract.create({ data: { ...body, status: "DRAFT" } as never, include: contractInclude });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateContractDto) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (contract?.status !== "DRAFT") {
      throw new BadRequestException("Contratos enviados nao podem ser editados.");
    }
    return this.prisma.contract.update({
      where: { id },
      data: { ...body, status: undefined } as never,
      include: contractInclude
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.contract.delete({ where: { id } });
  }

  @Post(":id/versions")
  async addVersion(@Param("id") contractId: string, @Body() body: CreateContractVersionDto) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (contract?.status !== "DRAFT") {
      throw new BadRequestException("Contratos enviados nao podem receber novos arquivos.");
    }
    return this.prisma.contractVersion.create({ data: { ...body, contractId } });
  }

  @Post(":id/send")
  async send(@Param("id") id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { versions: true }
    });
    if (!contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status !== "DRAFT") throw new BadRequestException("Apenas rascunhos podem ser enviados.");
    if (!isContractReady(contract)) {
      throw new BadRequestException("Informe titulo, valor, PDF, contratante, contratado e duas testemunhas antes de enviar.");
    }
    return this.prisma.contract.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      include: contractInclude
    });
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { versions: true }
    });
    if (!contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status === "SIGNED") throw new BadRequestException("Contratos assinados nao podem ser cancelados.");

    for (const version of contract.versions) {
      await deleteUploadedContractFile(version.fileUrl);
    }

    return this.prisma.contract.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), versions: { deleteMany: {} } },
      include: contractInclude
    });
  }

  @Post(":id/sign")
  async sign(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: SignContractDto) {
    const userId = request.user?.sub;
    const contract = await this.prisma.contract.findUnique({ where: { id }, include: { versions: true } });
    if (!userId || !contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status !== "SENT") throw new BadRequestException("Contrato indisponivel para assinatura.");

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, cpf: true, passwordHash: true }
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new BadRequestException("Senha invalida para assinatura.");
    }
    if (!user.cpf) {
      throw new BadRequestException("Cadastre o CPF da conta antes de assinar.");
    }

    const data: Record<string, Date> = {};
    const role = signatureRole(contract, userId);
    if (!role) throw new BadRequestException("Sua conta nao esta vinculada a este contrato.");
    if (role.field === "contractingPartySignedAt" && contract.contractingPartySignedAt) throw new BadRequestException("Assinatura ja registrada.");
    if (role.field === "contractorSignedAt" && contract.contractorSignedAt) throw new BadRequestException("Assinatura ja registrada.");
    if (role.field === "witnessOneSignedAt" && contract.witnessOneSignedAt) throw new BadRequestException("Assinatura ja registrada.");
    if (role.field === "witnessTwoSignedAt" && contract.witnessTwoSignedAt) throw new BadRequestException("Assinatura ja registrada.");
    data[role.field] = new Date();

    const documentHash = await uploadedContractHash(contract.versions);
    const token = bearerToken(request);
    const signed = await this.prisma.contract.update({ where: { id }, data });
    await this.prisma.contractSignatureLog.create({
      data: {
        contractId: id,
        userId,
        role: role.label,
        signerName: user.name,
        signerEmail: user.email,
        signerCpf: user.cpf,
        ipAddress: requestIp(request),
        tokenHash: token ? sha256(token) : undefined,
        documentHash,
      },
    });
    const allSigned = Boolean(signed.contractingPartySignedAt && signed.contractorSignedAt && signed.witnessOneSignedAt && signed.witnessTwoSignedAt);
    if (allSigned) {
      return this.pdf.generateSignedPdf(id);
    }
    return this.prisma.contract.findUnique({ where: { id }, include: contractInclude });
  }

  @Public()
  @Post("validate")
  async validate(@Body() body: ValidateContractDto) {
    const validationCodeHash = sha256(normalizeValidationCode(body.code));
    const contract = await this.prisma.contract.findFirst({
      where: { validationCodeHash, status: "SIGNED" },
      include: contractInclude
    });
    if (!contract) throw new BadRequestException("Senha de validacao invalida.");
    return contract;
  }
}

function isContractReady(contract: {
  title: string;
  value: unknown;
  contractorId?: string | null;
  contractingPartyId?: string | null;
  witnessOneId?: string | null;
  witnessTwoId?: string | null;
  versions: Array<{ fileUrl?: string | null }>;
}) {
  const participants = [contract.contractingPartyId, contract.contractorId, contract.witnessOneId, contract.witnessTwoId];
  return Boolean(
    contract.title.trim() &&
      Number(contract.value) > 0 &&
      participants.every(Boolean) &&
      new Set(participants).size === 4 &&
      contract.versions.some((version) => version.fileUrl)
  );
}

async function deleteUploadedContractFile(fileUrl?: string | null) {
  if (!fileUrl) return;
  try {
    const pathname = fileUrl.startsWith("http")
      ? new URL(fileUrl).pathname
      : fileUrl;
    if (!pathname.startsWith("/uploads/contracts/")) return;
    const filename = pathname.split("/").pop();
    if (!filename) return;
    await unlink(join(process.cwd(), "uploads", "contracts", filename));
  } catch {
    return;
  }
}

function signatureRole(contract: {
  contractingPartyId?: string | null;
  contractorId?: string | null;
  witnessOneId?: string | null;
  witnessTwoId?: string | null;
}, userId: string) {
  if (contract.contractingPartyId === userId) return { label: "Contratante", field: "contractingPartySignedAt" };
  if (contract.contractorId === userId) return { label: "Contratado", field: "contractorSignedAt" };
  if (contract.witnessOneId === userId) return { label: "Testemunha 1", field: "witnessOneSignedAt" };
  if (contract.witnessTwoId === userId) return { label: "Testemunha 2", field: "witnessTwoSignedAt" };
  return undefined;
}

async function uploadedContractHash(versions: Array<{ version: number; fileUrl?: string | null }>) {
  const source = [...versions].sort((a, b) => b.version - a.version).find((version) => version.fileUrl);
  if (!source?.fileUrl) return undefined;
  const pathname = source.fileUrl.startsWith("http") ? new URL(source.fileUrl).pathname : source.fileUrl;
  if (!pathname.startsWith("/uploads/contracts/")) return undefined;
  const bytes = await readFile(join(process.cwd(), "uploads", "contracts", basename(pathname)));
  return sha256(bytes);
}

function bearerToken(request: AuthenticatedRequest) {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

function requestIp(request: AuthenticatedRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return request.ip;
}

function sha256(value: Buffer | Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeValidationCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
