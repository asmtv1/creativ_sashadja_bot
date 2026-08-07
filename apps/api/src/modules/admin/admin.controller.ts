import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AdminAccessMutationRequestSchema } from "@course/shared";
import { AdminBasicGuard } from "../../common/guards/admin-basic.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAccessService } from "./admin-access.service";

@Controller("admin")
@UseGuards(AdminBasicGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AdminAccessService
  ) {}

  @Get("orders")
  async orders(@Query("status") status?: string, @Query("telegramId") telegramId?: string) {
    const rows = await this.prisma.order.findMany({
      where: {
        status: status as any,
        user: telegramId ? { telegramId } : undefined
      },
      include: { user: true, course: true },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((order) => ({
      id: order.id,
      telegramId: order.user.telegramId,
      courseSlug: order.course.slug,
      status: order.status,
      amountKopecks: order.amountKopecks,
      currency: order.currency,
      createdAt: order.createdAt.toISOString()
    }));
  }

  @Get("users/:telegramId/access")
  accessForUser(@Param("telegramId") telegramId: string) {
    return this.prisma.courseAccess.findMany({
      where: { user: { telegramId } },
      include: { course: true },
      orderBy: { grantedAt: "desc" }
    });
  }

  @Get("users/by-username/:username")
  async userByUsername(@Param("username") username: string) {
    const normalizedUsername = username.replace(/^@/, "").trim();
    const user = await this.prisma.telegramUser.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { telegramId: true }
    });
    return user ?? { telegramId: null };
  }

  @Post("access/grant")
  async grant(@Req() request: any, @Body() body: unknown) {
    const input = AdminAccessMutationRequestSchema.parse(body);
    await this.access.grant({ ...input, actor: request.adminActor ?? "admin" });
    return { ok: true };
  }

  @Post("access/revoke")
  async revoke(@Req() request: any, @Body() body: unknown) {
    const input = AdminAccessMutationRequestSchema.parse(body);
    await this.access.revoke({ ...input, actor: request.adminActor ?? "admin" });
    return { ok: true };
  }
}
