import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, name: true, email: true, role: true, passwordHash: true }
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: await bcrypt.hash(refreshToken, 10),
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });

    return {
      accessToken: this.sign(user.id, user.role),
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
  }

  async register(name: string, email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
    if (existing) throw new ConflictException("Email ja cadastrado");

    const user = await this.prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN"
      },
      select: { id: true, name: true, email: true, role: true }
    });

    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: await bcrypt.hash(refreshToken, 10),
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });

    return {
      accessToken: this.sign(user.id, user.role),
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
  }

  async refresh(refreshToken: string) {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true }
    });
    const record = await asyncFind(candidates, (candidate) => bcrypt.compare(refreshToken, candidate.tokenHash));
    if (!record) throw new UnauthorizedException("Invalid refresh token");
    return { accessToken: this.sign(record.user.id, record.user.role) };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    const candidates = await this.prisma.refreshToken.findMany({ where: { revoked: false } });
    const record = await asyncFind(candidates, (candidate) => bcrypt.compare(refreshToken, candidate.tokenHash));
    if (record) await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
    return { ok: true };
  }

  forgotPassword(email: string) {
    return { ok: true, email: normalizeEmail(email), mode: "local-mock" };
  }

  async resetPassword(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
      select: { id: true }
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) }
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId } : null;
  }

  private sign(sub: string, role: string) {
    return this.jwt.sign({ sub, role }, { secret: process.env.JWT_SECRET ?? "local-dev-secret" });
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function asyncFind<T>(items: T[], predicate: (item: T) => Promise<boolean>) {
  for (const item of items) {
    if (await predicate(item)) return item;
  }
  return undefined;
}
