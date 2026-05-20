import {
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
    return this.prisma.user.findMany({
      where:
        user?.role === "ADMIN"
          ? { OR: [{ id: user.sub }, { adminId: user.sub }] }
          : { id: user?.sub },
      select: {
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
      },
      orderBy: { createdAt: "asc" },
    });
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateUserDto,
  ) {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const adminId =
      request.user?.role === "ADMIN" ? request.user.sub : undefined;
    return this.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        phone: body.phone,
        address: body.address,
        role: body.role as never,
        clientId: body.clientId,
        adminId,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        role: true,
        clientId: true,
        adminId: true,
        createdAt: true,
      },
    });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateUserDto) {
    const passwordHash = body.password
      ? await bcrypt.hash(body.password, 10)
      : undefined;
    return this.prisma.user.update({
      where: { id },
      data: {
        email: body.email,
        name: body.name,
        phone: body.phone,
        address: body.address,
        role: body.role as never,
        clientId: body.clientId,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        role: true,
        clientId: true,
        updatedAt: true,
      },
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.user.delete({ where: { id }, select: { id: true } });
  }
}
