import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  BotCreateOrderRequestSchema,
  BotUserUpsertRequestSchema
} from "@course/shared";
import { InternalTokenGuard } from "../../common/guards/internal-token.guard";
import { CoursesService } from "../courses/courses.service";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

@Controller("internal/bot")
@UseGuards(InternalTokenGuard)
export class BotInternalController {
  constructor(
    private readonly users: UsersService,
    private readonly orders: OrdersService,
    private readonly courses: CoursesService,
    private readonly prisma: PrismaService
  ) {}

  @Post("users/upsert")
  upsertUser(@Body() body: unknown) {
    return this.users.upsertTelegramUser(BotUserUpsertRequestSchema.parse(body));
  }

  @Post("orders/checkout")
  createCourseCheckout(@Body() body: unknown) {
    const input = BotCreateOrderRequestSchema.parse(body);
    return this.orders.createCheckoutForTelegramUser(input.telegramId, input.courseSlug);
  }

  @Get("users/:telegramId/course-access")
  async getCourseAccess(
    @Param("telegramId") telegramId: string,
    @Query("courseSlug") courseSlug?: string
  ) {
    const user = await this.users.findByTelegramId(telegramId);
    const course = courseSlug
      ? await this.prisma.course.findUnique({ where: { slug: courseSlug } })
      : await this.courses.getDefaultCourse();
    if (!user || !course) {
      return { hasAccess: false };
    }
    return { hasAccess: await this.courses.hasAccess(user.id, course.id) };
  }

  @Get("outbox")
  async getOutbox(@Query("limit") limit?: string) {
    const take = Math.min(Number(limit ?? 20), 100);
    const candidates = await this.prisma.botOutbox.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        nextAttemptAt: { lte: new Date() },
        OR: [{ lockedAt: null }, { lockedAt: { lte: new Date(Date.now() - 5 * 60_000) } }]
      },
      orderBy: { createdAt: "asc" },
      take
    });
    const claimed = [];
    for (const item of candidates) {
      const result = await this.prisma.botOutbox.updateMany({ where: { id: item.id, OR: [{ lockedAt: null }, { lockedAt: { lte: new Date(Date.now() - 5 * 60_000) } }] }, data: { lockedAt: new Date() } });
      if (result.count === 1) claimed.push(item);
    }
    return claimed;
  }

  @Post("outbox/:id/sent")
  markSent(@Param("id") id: string) {
    return this.prisma.botOutbox.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), lastError: null, lockedAt: null }
    });
  }

  @Post("outbox/:id/failed")
  markFailed(@Param("id") id: string, @Body() body: { error?: string }) {
    return this.prisma.botOutbox.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: body.error ?? "Unknown Telegram delivery error",
        nextAttemptAt: new Date(Date.now() + 30_000),
        lockedAt: null
      }
    });
  }
}
