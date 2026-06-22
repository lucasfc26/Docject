import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter = createTransporter();

  async sendMail(input: SendMailInput) {
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@docject.local";
    if (!this.transporter) {
      this.logger.warn(`[email-mock] Para: ${input.to} | Assunto: ${input.subject}`);
      this.logger.warn(input.text);
      return { ok: true, mode: "mock" as const };
    }

    await this.transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, mode: "smtp" as const };
  }

  async sendAccountPassword(input: {
    to: string;
    name: string;
    password: string;
    reset?: boolean;
  }) {
    const appName = process.env.APP_NAME ?? "Docject";
    const loginUrl = publicAppUrl("/login");
    const intro = input.reset
      ? `Sua senha de acesso ao ${appName} foi redefinida.`
      : `Sua conta no ${appName} foi criada.`;
    const text = [
      `Ola, ${input.name}.`,
      "",
      intro,
      "",
      `E-mail: ${input.to}`,
      `Senha: ${input.password}`,
      "",
      `Acesse: ${loginUrl}`,
      "",
      "Por seguranca, altere a senha apos o primeiro acesso em Configuracoes.",
    ].join("\n");

    return this.sendMail({
      to: input.to,
      subject: input.reset ? `${appName} — senha redefinida` : `${appName} — dados de acesso`,
      text,
      html: text.replace(/\n/g, "<br>"),
    });
  }

  async sendPasswordResetCode(input: {
    to: string;
    name: string;
    code: string;
    resetUrl: string;
  }) {
    const appName = process.env.APP_NAME ?? "Docject";
    const text = [
      `Ola, ${input.name}.`,
      "",
      `Recebemos uma solicitacao para redefinir sua senha no ${appName}.`,
      "",
      `Codigo de verificacao: ${input.code}`,
      "",
      "Acesse o link abaixo, informe o codigo e defina uma nova senha:",
      input.resetUrl,
      "",
      "O codigo expira em 1 hora e pode ser usado apenas uma vez.",
      "Se voce nao solicitou esta alteracao, ignore este e-mail.",
    ].join("\n");

    return this.sendMail({
      to: input.to,
      subject: `${appName} — codigo para redefinir senha`,
      text,
      html: text.replace(/\n/g, "<br>"),
    });
  }

  async sendContractSigningRequest(input: {
    to: string;
    name: string;
    contractTitle: string;
    contractingPartyName: string;
  }) {
    const appName = process.env.APP_NAME ?? "Docject";
    const loginUrl = publicAppUrl("/login");
    const portalUrl = publicAppUrl("/client/dashboard");
    const text = [
      `Ola, ${input.name}.`,
      "",
      `Voce tem um contrato aguardando assinatura no ${appName}.`,
      "",
      `Documento: ${input.contractTitle}`,
      `Contratante: ${input.contractingPartyName}`,
      "",
      "Acesse o link abaixo, faca login com seu e-mail e senha e assine o contrato:",
      loginUrl,
      "",
      `Apos o login, voce sera direcionado ao portal: ${portalUrl}`,
    ].join("\n");

    return this.sendMail({
      to: input.to,
      subject: `${appName} — contrato aguardando assinatura: ${input.contractTitle}`,
      text,
      html: text.replace(/\n/g, "<br>"),
    });
  }
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true";
  return nodemailer.createTransport({
    host,
    port,
    secure,
    // Porta 587 = STARTTLS (TLS negociado apos conectar). Porta 465 = SSL desde o inicio.
    requireTLS: !secure && port === 587,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

function publicAppUrl(path: string) {
  const base = (process.env.APP_PUBLIC_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
