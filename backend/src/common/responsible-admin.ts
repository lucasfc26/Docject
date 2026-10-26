import { PrismaService } from "../prisma/prisma.service";

/** Staff users act on behalf of the admin that created them; admins answer for themselves. */
export async function resolveResponsibleAdminId(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, adminId: true },
  });
  return user?.adminId ?? user?.id ?? userId;
}
