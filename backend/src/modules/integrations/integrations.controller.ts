import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("integrations")
@Controller("integrations")
export class IntegrationsController {
  @Get()
  status() {
    return {
      email: process.env.SMTP_HOST ? "configured" : "local-mock",
      whatsapp: process.env.WHATSAPP_API_TOKEN ? "configured" : "local-mock",
      redis: process.env.REDIS_URL ? "configured" : "disabled"
    };
  }

  @Post("email/test")
  sendEmail(@Body() body: { to: string; subject: string; template?: string }) {
    return { ok: true, provider: process.env.SMTP_HOST ? "smtp" : "local-mock", payload: body };
  }

  @Post("whatsapp/test")
  sendWhatsapp(@Body() body: { to: string; message: string }) {
    return { ok: true, provider: process.env.WHATSAPP_PROVIDER ?? "local-mock", payload: body };
  }
}
