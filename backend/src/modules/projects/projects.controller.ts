import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, projectScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCommentDto, CreateMilestoneDto, CreateProjectDto, CreateProjectModuleDto, UpdateMilestoneDto, UpdateProjectDto, UpdateProjectModuleDto } from "./dto/project.dto";

@ApiTags("projects")
@Controller("projects")
export class ProjectsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.prisma.project.findMany({
      where: projectScope(request.user),
      include: { client: true, modules: { orderBy: { orderIndex: "asc" }, include: { milestones: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.prisma.project.findFirst({
      where: { id, ...projectScope(request.user) },
      include: { client: true, modules: { orderBy: { orderIndex: "asc" }, include: { milestones: true } }, comments: true }
    });
  }

  @Post()
  create(@Body() body: CreateProjectDto) {
    return this.prisma.project.create({ data: body as never, include: { client: true } });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateProjectDto) {
    return this.prisma.project.update({ where: { id }, data: body as never });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.project.delete({ where: { id } });
  }

  @Post(":id/modules")
  async addModule(@Param("id") projectId: string, @Body() body: CreateProjectModuleDto) {
    const orderIndex = body.orderIndex ?? (await this.prisma.projectModule.count({ where: { projectId } })) + 1;
    const module = await this.prisma.projectModule.create({ data: { ...this.normalizeModulePayload(body), orderIndex, projectId } as never });
    if (module.completed) await this.ensurePaymentOrder(module.id);
    await this.syncModuleDeliveryArtifacts(module.id);
    return module;
  }

  @Patch("modules/:moduleId")
  async updateModule(@Param("moduleId") moduleId: string, @Body() body: UpdateProjectModuleDto) {
    const previous = await this.prisma.projectModule.findUnique({ where: { id: moduleId } });
    const completedAt = body.completed === true && !previous?.completed ? new Date() : body.completed === false ? null : undefined;
    const module = await this.prisma.projectModule.update({
      where: { id: moduleId },
      data: { ...this.normalizeModulePayload(body), completedAt } as never
    });

    if (module.completed) await this.ensurePaymentOrder(module.id);
    await this.syncModuleDeliveryArtifacts(module.id);
    return module;
  }

  @Delete("modules/:moduleId")
  removeModule(@Param("moduleId") moduleId: string) {
    return this.prisma.projectModule.delete({ where: { id: moduleId } });
  }

  @Post("modules/:moduleId/milestones")
  addMilestone(@Param("moduleId") moduleId: string, @Body() body: CreateMilestoneDto) {
    return this.prisma.milestone.create({
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined, moduleId }
    });
  }

  @Patch("milestones/:id")
  updateMilestone(@Param("id") id: string, @Body() body: UpdateMilestoneDto) {
    return this.prisma.milestone.update({
      where: { id },
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined }
    });
  }

  @Post(":id/comments")
  addComment(@Param("id") projectId: string, @Body() body: CreateCommentDto) {
    return this.prisma.comment.create({ data: { ...body, projectId } });
  }

  private async ensurePaymentOrder(moduleId: string) {
    const module = await this.prisma.projectModule.findUnique({
      where: { id: moduleId },
      include: { project: { include: { client: true } } }
    });

    if (!module || Number(module.value) <= 0) return;

    return this.prisma.financialTransaction.upsert({
      where: { moduleId },
      update: {
        entity: `${module.project.client.name} - ${module.project.name} - ${module.name}`,
        amount: module.value,
        dueDate: module.completedAt ?? new Date()
      },
      create: {
        entity: `${module.project.client.name} - ${module.project.name} - ${module.name}`,
        kind: "REVENUE",
        amount: module.value,
        status: "PENDING",
        dueDate: module.completedAt ?? new Date(),
        moduleId
      }
    });
  }

  private normalizeModulePayload(body: CreateProjectModuleDto | UpdateProjectModuleDto) {
    const startDate = body.startDate ? new Date(body.startDate) : undefined;
    const endDate = body.endDate ? new Date(body.endDate) : undefined;
    return {
      ...body,
      startDate,
      endDate,
      businessDays: startDate && endDate ? countBusinessDays(startDate, endDate) : body.businessDays
    };
  }

  private async syncModuleDeliveryArtifacts(moduleId: string) {
    const module = await this.prisma.projectModule.findUnique({
      where: { id: moduleId },
      include: { project: { include: { client: true } } }
    });

    if (!module?.endDate) {
      await this.prisma.appointment.deleteMany({ where: { moduleId } });
      await this.prisma.notification.deleteMany({ where: { moduleId } });
      return;
    }

    const deliveryStart = new Date(module.endDate);
    deliveryStart.setHours(9, 0, 0, 0);
    const deliveryEnd = new Date(module.endDate);
    deliveryEnd.setHours(10, 0, 0, 0);
    const startLabel = module.startDate ? module.startDate.toLocaleDateString("pt-BR") : "sem inicio";
    const endLabel = module.endDate.toLocaleDateString("pt-BR");
    const title = `Entrega: ${module.name}`;

    await this.prisma.appointment.upsert({
      where: { moduleId },
      update: {
        title,
        client: module.project.client.name,
        location: module.project.name,
        startsAt: deliveryStart,
        endsAt: deliveryEnd,
        notes: `Modulo ${module.orderIndex}: ${startLabel} ate ${endLabel}. ${module.businessDays} dias uteis.`
      },
      create: {
        title,
        client: module.project.client.name,
        location: module.project.name,
        startsAt: deliveryStart,
        endsAt: deliveryEnd,
        notes: `Modulo ${module.orderIndex}: ${startLabel} ate ${endLabel}. ${module.businessDays} dias uteis.`,
        moduleId
      }
    });

    await this.prisma.notification.upsert({
      where: { moduleId },
      update: {
        title: `${title} em ${endLabel}`,
        type: module.completed ? "SUCCESS" : "DELIVERY",
        read: false
      },
      create: {
        title: `${title} em ${endLabel}`,
        type: module.completed ? "SUCCESS" : "DELIVERY",
        moduleId
      }
    });
  }
}

function countBusinessDays(start: Date, end: Date) {
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setHours(0, 0, 0, 0);
  if (cursor > limit) return 0;

  let total = 0;
  while (cursor <= limit) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}
