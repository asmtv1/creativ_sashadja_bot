import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  BotCompleteTelegramPaymentRequestSchema,
  BotCreateOrderRequestSchema,
  BotValidateTelegramInvoiceRequestSchema,
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

  @Post("orders")
  createOrder(@Body() body: unknown) {
    const input = BotCreateOrderRequestSchema.parse(body);
    return this.orders.createOrderForTelegramUser(input.telegramId, input.courseSlug);
  }

  @Post("orders/:orderId/telegram/pre-checkout")
  validateTelegramInvoice(@Param("orderId") orderId: string, @Body() body: unknown) {
    const input = BotValidateTelegramInvoiceRequestSchema.parse(body);
    return this.orders.validateTelegramInvoicePayment({ orderId, ...input });
  }

  @Post("orders/:orderId/telegram/successful-payment")
  completeTelegramPayment(@Param("orderId") orderId: string, @Body() body: unknown) {
    const input = BotCompleteTelegramPaymentRequestSchema.parse(body);
    return this.orders.completeTelegramInvoicePayment({
      orderId,
      telegramId: input.telegramId,
      providerPaymentChargeId: input.providerPaymentChargeId,
      telegramPaymentChargeId: input.telegramPaymentChargeId,
      amountKopecks: input.amountKopecks,
      currency: input.currency,
      rawPayload: input.rawPayload ?? null
    });
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
    return this.prisma.botOutbox.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        nextAttemptAt: { lte: new Date() }
      },
      orderBy: { createdAt: "asc" },
      take
    });
  }

  @Post("outbox/:id/sent")
  markSent(@Param("id") id: string) {
    return this.prisma.botOutbox.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), lastError: null }
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
        nextAttemptAt: new Date(Date.now() + 30_000)
      }
    });
  }
}
