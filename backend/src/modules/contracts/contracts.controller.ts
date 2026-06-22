import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import * as bcrypt from "bcrypt";
import { ContractParticipantRole, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { join } from "node:path";
import { Public } from "../../common/public.decorator";
import { AuthenticatedRequest, contractScope } from "../../common/current-user";
import { requestIp, requestUserAgent } from "../../common/request-ip";
import { PrismaService } from "../../prisma/prisma.service";
import { ContractPdfService } from "./contract-pdf.service";
import {
  allParticipantsSigned,
  canManageContractParticipants,
  nextWitnessIndex,
  participantLabel,
  participantSignLabel,
} from "./contracts.helpers";
import {
  AddContractParticipantDto,
  CreateContractDto,
  CreateContractVersionDto,
  SignContractDto,
  UpdateContractDto,
  ValidateContractDto,
} from "./dto/contract.dto";

const userSelect = { id: true, name: true, email: true, role: true, cpf: true } as const;
const actorSelect = { id: true, name: true, email: true } as const;

const contractInclude = {
  versions: true,
  client: true,
  createdBy: { select: actorSelect },
  participants: {
    orderBy: [{ role: "asc" }, { witnessIndex: "asc" }, { addedAt: "asc" }] as Prisma.ContractParticipantOrderByWithRelationInput[],
    include: {
      user: { select: userSelect },
      addedBy: { select: actorSelect },
    },
  },
  eventLogs: { orderBy: { createdAt: "asc" } },
  signatureLogs: { orderBy: { signedAt: "asc" } },
} satisfies Prisma.ContractInclude;

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
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateContractDto) {
    const actorId = request.user?.sub;
    const actor = actorId ? await this.prisma.user.findUnique({ where: { id: actorId }, select: actorSelect }) : null;
    const contractingParty = await this.prisma.user.findUnique({ where: { id: body.contractingPartyId }, select: userSelect });
    if (!contractingParty) throw new BadRequestException("Contratante invalido.");

    const contract = await this.prisma.contract.create({
      data: {
        title: body.title,
        value: body.value ?? 0,
        status: "DRAFT",
        clientId: body.clientId,
        createdById: actorId,
        participants: {
          create: {
            userId: body.contractingPartyId,
            role: "CONTRACTING_PARTY",
            addedById: actorId,
          },
        },
        eventLogs: {
          create: {
            eventType: "CREATED",
            actorUserId: actorId,
            actorName: actor?.name,
            actorEmail: actor?.email,
            description: buildCreatedDescription(actor, contractTitle(body.title)),
            metadata: {
              contractingPartyId: body.contractingPartyId,
              contractingPartyName: contractingParty.name,
              contractingPartyEmail: contractingParty.email,
            },
          },
        },
      },
      include: contractInclude,
    });

    return contract;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateContractDto) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (contract?.status !== "DRAFT") {
      throw new BadRequestException("Contratos enviados nao podem ser editados.");
    }
    return this.prisma.contract.update({
      where: { id },
      data: body as never,
      include: contractInclude,
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.contract.delete({ where: { id } });
  }

  @Post(":id/participants")
  async addParticipant(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: AddContractParticipantDto) {
    const actorId = request.user?.sub;
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status !== "DRAFT" && contract.status !== "SENT") {
      throw new BadRequestException("Participantes so podem ser adicionados em rascunhos ou contratos enviados.");
    }
    if (!canManageContractParticipants(request.user, contract)) {
      throw new BadRequestException("Sem permissao para adicionar participantes.");
    }

    const participantUserId = await resolveParticipantUserId(this.prisma, body);
    const user = await this.prisma.user.findUnique({ where: { id: participantUserId }, select: userSelect });
    if (!user) throw new BadRequestException("Usuario invalido.");
    if (contract.participants.some((participant) => participant.userId === participantUserId)) {
      throw new BadRequestException("Este usuario ja participa do contrato.");
    }
    if (body.role === "CONTRACTOR" && contract.participants.some((participant) => participant.role === "CONTRACTOR")) {
      throw new BadRequestException("O contrato ja possui um contratado.");
    }

    const actor = actorId ? await this.prisma.user.findUnique({ where: { id: actorId }, select: actorSelect }) : null;
    const witnessIndex = body.role === "WITNESS" ? nextWitnessIndex(contract.participants) : null;
    const roleLabel = participantLabel(body.role, witnessIndex);

    await this.prisma.contractParticipant.create({
      data: {
        contractId: id,
        userId: participantUserId,
        role: body.role,
        witnessIndex,
        addedById: actorId,
      },
    });

    await this.prisma.contractEventLog.create({
      data: {
        contractId: id,
        eventType: "PARTICIPANT_ADDED",
        actorUserId: actorId,
        actorName: actor?.name,
        actorEmail: actor?.email,
        description: buildParticipantAddedDescription(actor, user, roleLabel),
        metadata: {
          participantUserId: user.id,
          participantName: user.name,
          participantEmail: user.email,
          participantCpf: user.cpf,
          role: body.role,
          witnessIndex,
        },
        ipAddress: requestIp(request),
      },
    });

    return this.prisma.contract.findUnique({ where: { id }, include: contractInclude });
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
  async send(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const actorId = request.user?.sub;
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { versions: true, participants: true },
    });
    if (!contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status !== "DRAFT") throw new BadRequestException("Apenas rascunhos podem ser enviados.");
    if (!isContractReady(contract)) {
      throw new BadRequestException("Informe titulo, valor, PDF e contratante antes de enviar.");
    }

    const actor = actorId ? await this.prisma.user.findUnique({ where: { id: actorId }, select: actorSelect }) : null;
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        eventLogs: {
          create: {
            eventType: "SENT",
            actorUserId: actorId,
            actorName: actor?.name,
            actorEmail: actor?.email,
            description: buildSentDescription(actor, contract.title),
            ipAddress: requestIp(request),
          },
        },
      },
      include: contractInclude,
    });
    return updated;
  }

  @Post(":id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const actorId = request.user?.sub;
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { versions: true },
    });
    if (!contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status === "SIGNED") throw new BadRequestException("Contratos assinados nao podem ser cancelados.");

    for (const version of contract.versions) {
      await deleteUploadedContractFile(version.fileUrl);
    }

    const actor = actorId ? await this.prisma.user.findUnique({ where: { id: actorId }, select: actorSelect }) : null;
    return this.prisma.contract.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        versions: { deleteMany: {} },
        eventLogs: {
          create: {
            eventType: "CANCELLED",
            actorUserId: actorId,
            actorName: actor?.name,
            actorEmail: actor?.email,
            description: buildCancelledDescription(actor, contract.title),
            ipAddress: requestIp(request),
          },
        },
      },
      include: contractInclude,
    });
  }

  @Post(":id/sign")
  async sign(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: SignContractDto) {
    const userId = request.user?.sub;
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { versions: true, participants: true },
    });
    if (!userId || !contract) throw new BadRequestException("Contrato nao encontrado.");
    if (contract.status !== "SENT") throw new BadRequestException("Contrato indisponivel para assinatura.");

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, cpf: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new BadRequestException("Senha invalida para assinatura.");
    }
    if (!user.cpf) {
      throw new BadRequestException("Cadastre o CPF da conta antes de assinar.");
    }

    const participant = contract.participants.find((entry) => entry.userId === userId);
    if (!participant) throw new BadRequestException("Sua conta nao esta vinculada a este contrato.");
    if (participant.signedAt) throw new BadRequestException("Assinatura ja registrada.");

    const roleLabel = participantLabel(participant.role, participant.witnessIndex);
    const documentHash = await uploadedContractHash(contract.versions);
    const token = bearerToken(request);
    const signedAt = new Date();

    await this.prisma.contractParticipant.update({
      where: { id: participant.id },
      data: { signedAt },
    });

    await this.prisma.contractSignatureLog.create({
      data: {
        contractId: id,
        userId,
        role: roleLabel,
        signerName: user.name,
        signerEmail: user.email,
        signerCpf: user.cpf,
        ipAddress: requestIp(request),
        userAgent: requestUserAgent(request),
        latitude: body.latitude,
        longitude: body.longitude,
        geoAccuracy: body.geoAccuracy,
        tokenHash: token ? sha256(token) : undefined,
        documentHash,
      },
    });

    await this.prisma.contractEventLog.create({
      data: {
        contractId: id,
        eventType: "SIGNED",
        actorUserId: userId,
        actorName: user.name,
        actorEmail: user.email,
        description: buildSignedDescription(user, participant.role, participant.witnessIndex, requestIp(request), body),
        metadata: {
          role: participant.role,
          witnessIndex: participant.witnessIndex,
          tokenHash: token ? sha256(token) : undefined,
          documentHash,
          latitude: body.latitude,
          longitude: body.longitude,
        },
        ipAddress: requestIp(request),
      },
    });

    const refreshed = await this.prisma.contract.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!refreshed) throw new BadRequestException("Contrato nao encontrado.");

    if (allParticipantsSigned(refreshed.participants)) {
      await this.prisma.contractEventLog.create({
        data: {
          contractId: id,
          eventType: "FINALIZED",
          description: `Processo de assinatura finalizado automaticamente para o documento ${id}.`,
        },
      });
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
      include: contractInclude,
    });
    if (!contract) throw new BadRequestException("Senha de validacao invalida.");
    return contract;
  }
}

function isContractReady(contract: {
  title: string;
  value: unknown;
  participants: Array<{ role: ContractParticipantRole }>;
  versions: Array<{ fileUrl?: string | null }>;
}) {
  const hasContractingParty = contract.participants.some((participant) => participant.role === "CONTRACTING_PARTY");
  return Boolean(
    contract.title.trim() &&
      Number(contract.value) > 0 &&
      hasContractingParty &&
      contract.versions.some((version) => version.fileUrl)
  );
}

async function deleteUploadedContractFile(fileUrl?: string | null) {
  if (!fileUrl) return;
  try {
    const pathname = fileUrl.startsWith("http") ? new URL(fileUrl).pathname : fileUrl;
    if (!pathname.startsWith("/uploads/contracts/")) return;
    const filename = pathname.split("/").pop();
    if (!filename) return;
    await unlink(join(process.cwd(), "uploads", "contracts", filename));
  } catch {
    return;
  }
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

function sha256(value: Buffer | Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeValidationCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function resolveParticipantUserId(
  prisma: PrismaService,
  body: { userId?: string; email?: string }
) {
  if (body.userId) return body.userId;
  const email = body.email?.trim().toLowerCase();
  if (!email) throw new BadRequestException("Informe o usuario ou e-mail do participante.");
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) throw new BadRequestException("Nenhuma conta encontrada para este e-mail.");
  return user.id;
}

function contractTitle(title: string) {
  return title.trim() || "sem titulo";
}

function buildCreatedDescription(actor: { name: string; email: string } | null, title: string) {
  const who = actor ? `Operador com email ${actor.email}` : "Sistema";
  return `${who} criou este documento "${title}".`;
}

function buildParticipantAddedDescription(
  actor: { name: string; email: string } | null,
  participant: { name: string; email: string; cpf?: string | null },
  roleLabel: string
) {
  const who = actor ? `Operador com email ${actor.email}` : "Sistema";
  return `${who} adicionou a lista de assinatura: ${participant.email} para assinar como ${roleLabel.toLowerCase()}. Dados informados: nome ${participant.name} e CPF ${participant.cpf ?? "-"}.`;
}

function buildSentDescription(actor: { name: string; email: string } | null, title: string) {
  const who = actor ? `Operador com email ${actor.email}` : "Sistema";
  return `${who} enviou o documento "${title}" para assinatura.`;
}

function buildCancelledDescription(actor: { name: string; email: string } | null, title: string) {
  const who = actor ? `Operador com email ${actor.email}` : "Sistema";
  return `${who} cancelou o documento "${title}".`;
}

function buildSignedDescription(
  user: { name: string; email: string; cpf?: string | null },
  role: ContractParticipantRole,
  witnessIndex: number | null | undefined,
  ip?: string,
  body?: SignContractDto
) {
  const action = participantSignLabel(role, witnessIndex);
  const parts = [
    `${user.name} ${action}.`,
    `CPF informado: ${user.cpf ?? "-"}.`,
    `E-mail: ${user.email}.`,
    ip ? `IP: ${ip}.` : undefined,
    body?.latitude != null && body?.longitude != null
      ? `Localizacao compartilhada: latitude ${body.latitude} e longitude ${body.longitude}.`
      : undefined,
  ].filter(Boolean);
  return parts.join(" ");
}
