import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { MailModule } from "./common/mail/mail.module";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { ActivityModule } from "./modules/activity/activity.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { FinancialModule } from "./modules/financial/financial.module";
import { FeaturesModule } from "./modules/features/features.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { ServicesModule } from "./modules/services/services.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { UsersModule } from "./modules/users/users.module";
import { SearchModule } from "./modules/search/search.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "local-dev-secret",
      signOptions: { expiresIn: "15m" }
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    ClientsModule,
    ProjectsModule,
    ContractsModule,
    FinancialModule,
    FeaturesModule,
    AppointmentsModule,
    NotificationsModule,
    ResourcesModule,
    ServicesModule,
    SettingsModule,
    UploadsModule,
    ActivityModule,
    IntegrationsModule,
    SearchModule
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
})
export class AppModule {}
