import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { MailService } from "../../common/mail/mail.service";
import { generateRandomPassword } from "../../common/password.util";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Get()
  async findAll(@Req() request: AuthenticatedRequest) {
    const user = request.user;
    if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
      return this.prisma.user.findMany({
        where: { id: user?.sub },
        select: userSelect,
        orderBy: { createdAt: "asc" },
      });
    }
    const adminId = await this.resolveResponsibleAdminId(user.sub);
    return this.prisma.user.findMany({
      where: { OR: [{ id: adminId }, { adminId }] },
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateUserDto,
  ) {
    const requestedRole = body.role ?? "CLIENT";
    this.assertCanCreateRole(request.user?.role, requestedRole);
    const email = normalizeEmail(body.email);
    await this.assertEmailAvailable(email);
    const plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const adminId = request.user
      ? await this.resolveResponsibleAdminId(request.user.sub)
      : undefined;
    const user = await this.prisma.user.create({
      data: {
        email,
        name: body.name,
        phone: body.phone,
        cpf: body.cpf,
        address: body.address,
        role: requestedRole as never,
        clientId: requestedRole === "CLIENT" ? body.clientId : null,
        adminId,
        passwordHash,
      },
      select: userSelect,
    });

    await this.mail.sendAccountPassword({
      to: user.email,
      name: user.name,
      password: plainPassword,
    });

    return user;
  }

  @Patch(":id")
  async update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: UpdateUserDto) {
    const email = body.email ? normalizeEmail(body.email) : undefined;
    if (email) await this.assertEmailAvailable(email, id);
    const isSelf = request.user?.sub === id;
    if (isSelf && (body.role !== undefined || body.clientId !== undefined)) {
      throw new BadRequestException("Nao e permitido alterar seu proprio perfil de acesso.");
    }
    const role = !isSelf && body.role ? body.role : undefined;
    if (role) this.assertCanCreateRole(request.user?.role, role);
    return this.prisma.user.update({
      where: { id },
      data: {
        email,
        name: body.name,
        phone: body.phone,
        cpf: body.cpf,
        address: body.address,
        role: role as never,
        clientId: role === "CLIENT" ? body.clientId : role ? null : undefined,
      },
      select: userSelect,
    });
  }

  @Post(":id/reset-password")
  async resetPassword(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (request.user?.role !== "ADMIN" && request.user?.role !== "MANAGER") {
      throw new BadRequestException("Sem permissao para redefinir senha.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, adminId: true },
    });
    if (!user) throw new BadRequestException("Usuario nao encontrado.");

    const adminId = await this.resolveResponsibleAdminId(request.user!.sub);
    if (user.id !== adminId && user.adminId !== adminId) {
      throw new BadRequestException("Sem permissao para redefinir senha deste usuario.");
    }

    const plainPassword = generateRandomPassword();
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(plainPassword, 10) },
    });

    await this.mail.sendAccountPassword({
      to: user.email,
      name: user.name,
      password: plainPassword,
      reset: true,
    });

    return { ok: true, email: user.email };
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.user.delete({ where: { id }, select: { id: true } });
  }

  private assertCanCreateRole(actorRole: string | undefined, requestedRole: string) {
    const allowed = allowedCreatedRoles[actorRole ?? ""] ?? [];
    if (!allowed.includes(requestedRole)) {
      throw new BadRequestException("Seu perfil nao permite criar ou atribuir este tipo de usuario.");
    }
  }

  private async resolveResponsibleAdminId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, adminId: true },
    });
    return user?.adminId ?? user?.id ?? userId;
  }

  private async assertEmailAvailable(email: string, ignoredUserId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing && existing.id !== ignoredUserId) {
      throw new ConflictException("Email ja cadastrado");
    }
  }
}

const allowedCreatedRoles: Record<string, string[]> = {
  ADMIN: ["MANAGER", "FINANCIAL", "CLIENT"],
  MANAGER: ["FINANCIAL", "CLIENT"],
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  cpf: true,
  address: true,
  role: true,
  clientId: true,
  adminId: true,
  client: true,
  createdAt: true,
  updatedAt: true,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
