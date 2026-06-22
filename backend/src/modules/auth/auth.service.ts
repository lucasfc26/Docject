import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomBytes, randomInt } from "crypto";
import { MailService } from "../../common/mail/mail.service";
import { PrismaService } from "../../prisma/prisma.service";

const passwordResetTtlMs = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, name: true, email: true, role: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: await bcrypt.hash(refreshToken, 10),
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    return {
      accessToken: this.sign(user.id, user.role),
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async register(name: string, email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existing) throw new ConflictException("Email ja cadastrado");

    const user = await this.prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: await bcrypt.hash(refreshToken, 10),
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    return {
      accessToken: this.sign(user.id, user.role),
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refresh(refreshToken: string) {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    const record = await asyncFind(candidates, (candidate) =>
      bcrypt.compare(refreshToken, candidate.tokenHash),
    );
    if (!record) throw new UnauthorizedException("Invalid refresh token");
    return { accessToken: this.sign(record.user.id, record.user.role) };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    const candidates = await this.prisma.refreshToken.findMany({ where: { revoked: false } });
    const record = await asyncFind(candidates, (candidate) =>
      bcrypt.compare(refreshToken, candidate.tokenHash),
    );
    if (record) await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    });

    if (user) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + passwordResetTtlMs);

      try {
        await this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        });

        await this.prisma.passwordResetToken.create({
          data: { userId: user.id, codeHash, expiresAt },
        });

        const resetUrl = `${publicAppUrl("/reset-password")}?email=${encodeURIComponent(user.email)}`;
        await this.mail.sendPasswordResetCode({
          to: user.email,
          name: user.name,
          code,
          resetUrl,
        });
      } catch (error) {
        await this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        });
        this.logger.error(`Falha ao enviar codigo de recuperacao para ${user.email}`, error);
      }
    }

    return {
      ok: true,
      message: "Se o e-mail estiver cadastrado, enviaremos um codigo de verificacao.",
    };
  }

  async resetPassword(email: string, code: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException("Codigo invalido ou expirado.");

    const token = await findValidPasswordResetToken(this.prisma, user.id, code);
    if (!token) throw new UnauthorizedException("Codigo invalido ou expirado.");

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(password, 10) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, id: { not: token.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  async changePassword(userId: string, currentPassword: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Senha atual invalida.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
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

async function findValidPasswordResetToken(
  prisma: PrismaService,
  userId: string,
  code: string,
) {
  const tokens = await prisma.passwordResetToken.findMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const token of tokens) {
    if (await bcrypt.compare(code, token.codeHash)) return token;
  }

  return undefined;
}

function publicAppUrl(path: string) {
  const base = (process.env.APP_PUBLIC_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
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
