import {
  BadRequestException,
  Body,
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
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    const user = request.user;
    if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
      return this.prisma.user.findMany({
        where: { id: user?.sub },
        select: userSelect,
        orderBy: { createdAt: "asc" },
      });
    }
    return this.prisma.user.findMany({
      where: { OR: [{ id: user.sub }, { adminId: user.sub }] },
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
    const passwordHash = await bcrypt.hash(body.password, 10);
    const adminId =
      request.user?.role === "ADMIN" || request.user?.role === "MANAGER"
        ? request.user.sub
        : undefined;
    return this.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        phone: body.phone,
        address: body.address,
        role: requestedRole as never,
        clientId: requestedRole === "CLIENT" ? body.clientId : null,
        adminId,
        passwordHash,
      },
      select: userSelect,
    });
  }

  @Patch(":id")
  async update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: UpdateUserDto) {
    const passwordHash = body.password
      ? await bcrypt.hash(body.password, 10)
      : undefined;
    const isSelf = request.user?.sub === id;
    if (isSelf && (body.role !== undefined || body.clientId !== undefined)) {
      throw new BadRequestException("Nao e permitido alterar seu proprio perfil de acesso.");
    }
    const role = !isSelf && body.role ? body.role : undefined;
    if (role) this.assertCanCreateRole(request.user?.role, role);
    return this.prisma.user.update({
      where: { id },
      data: {
        email: body.email,
        name: body.name,
        phone: body.phone,
        address: body.address,
        role: role as never,
        clientId: role === "CLIENT" ? body.clientId : role ? null : undefined,
        passwordHash,
      },
      select: userSelect,
    });
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
  address: true,
  role: true,
  clientId: true,
  adminId: true,
  client: true,
  createdAt: true,
  updatedAt: true,
};
