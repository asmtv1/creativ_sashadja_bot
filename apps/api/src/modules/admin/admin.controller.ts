import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminAccessMutationRequestSchema } from "@course/shared";
import { AdminBasicGuard } from "../../common/guards/admin-basic.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAccessService } from "./admin-access.service";
import { AdminChannelAccessService } from "./admin-channel-access.service";

const COURSE_SLUG = "basic-course";
const CHANNEL_PRODUCT_SLUG = "creative-ideas";

@Controller("admin")
@UseGuards(AdminBasicGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AdminAccessService,
    private readonly channelAccess: AdminChannelAccessService,
  ) {}

  @Get("dashboard/course")
  async courseDashboard() {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { slug: COURSE_SLUG },
    });
    const [users, paidOrders, openedBot, revenue] = await Promise.all([
      this.prisma.telegramUser.findMany({
        include: {
          access: { where: { courseId: course.id }, take: 1 },
          orders: {
            where: { courseId: course.id, status: "PAID" },
            orderBy: { paidAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.prisma.order.findMany({
        where: { courseId: course.id, status: "PAID" },
        select: { userId: true },
      }),
      this.prisma.telegramUser.count(),
      this.prisma.order.aggregate({
        where: { courseId: course.id, status: "PAID" },
        _sum: { amountKopecks: true },
      }),
    ]);
    return {
      product: {
        key: "course",
        title: course.title,
        priceKopecks: course.priceKopecks,
        currency: course.currency,
      },
      metrics: {
        openedBot,
        paidUsers: new Set(paidOrders.map((order) => order.userId)).size,
        revenueKopecks: revenue._sum.amountKopecks ?? 0,
      },
      users: users.map((user) => {
        const access = user.access[0];
        const order = user.orders[0];
        return {
          telegramId: user.telegramId,
          username: user.username,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
          firstSeenAt: user.createdAt.toISOString(),
          hasAccess: Boolean(access && !access.revokedAt),
          source: access?.source ?? null,
          paidAt: order?.paidAt?.toISOString() ?? null,
          amountKopecks: order?.amountKopecks ?? null,
        };
      }),
    };
  }

  @Get("dashboard/channel")
  async channelDashboard() {
    const product = await this.prisma.channelProduct.findUniqueOrThrow({
      where: { slug: CHANNEL_PRODUCT_SLUG },
    });
    const [users, payments, openedBot, revenue] = await Promise.all([
      this.prisma.telegramUser.findMany({
        include: {
          channelSubscriptions: {
            where: { productId: product.id },
            include: {
              payments: {
                where: { status: "SUCCEEDED" },
                orderBy: { paidAt: "desc" },
                take: 1,
              },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.prisma.channelPayment.findMany({
        where: { subscription: { productId: product.id }, status: "SUCCEEDED" },
        select: { subscriptionId: true },
      }),
      this.prisma.telegramUser.count(),
      this.prisma.channelPayment.aggregate({
        where: { subscription: { productId: product.id }, status: "SUCCEEDED" },
        _sum: { amountKopecks: true },
      }),
    ]);
    const now = new Date();
    return {
      product: {
        key: "channel",
        title: product.title,
        priceKopecks: product.priceKopecks,
        currency: product.currency,
      },
      metrics: {
        openedBot,
        paidUsers: new Set(payments.map((payment) => payment.subscriptionId))
          .size,
        revenueKopecks: revenue._sum.amountKopecks ?? 0,
      },
      users: users.map((user) => {
        const subscription = user.channelSubscriptions[0];
        const payment = subscription?.payments[0];
        const hasAccess = Boolean(
          subscription?.periodEnd &&
          subscription.periodEnd > now &&
          ["ACTIVE", "PAST_DUE", "CANCELED_AT_PERIOD_END"].includes(
            subscription.status,
          ),
        );
        return {
          telegramId: user.telegramId,
          username: user.username,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
          firstSeenAt: user.createdAt.toISOString(),
          hasAccess,
          source: subscription ? (payment ? "PAYMENT" : "ADMIN") : null,
          paidAt: payment?.paidAt?.toISOString() ?? null,
          amountKopecks: payment?.amountKopecks ?? null,
          accessUntil: subscription?.periodEnd?.toISOString() ?? null,
          autoRenew: subscription?.autoRenew ?? false,
        };
      }),
    };
  }

  @Get("orders")
  async orders(
    @Query("status") status?: string,
    @Query("telegramId") telegramId?: string,
  ) {
    const rows = await this.prisma.order.findMany({
      where: {
        status: status as any,
        user: telegramId ? { telegramId } : undefined,
      },
      include: { user: true, course: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((order) => ({
      id: order.id,
      telegramId: order.user.telegramId,
      courseSlug: order.course.slug,
      status: order.status,
      amountKopecks: order.amountKopecks,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    }));
  }

  @Get("npd-receipts")
  async npdReceipts() {
    const receipts = await this.prisma.npdReceipt.findMany({
      include: {
        user: true,
        order: { include: { course: true } },
        channelPayment: { include: { subscription: { include: { product: true } } } },
        operations: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { operationAt: "desc" },
      take: 500,
    });
    return receipts.map((receipt) => {
      const operation = receipt.operations[0];
      const product = receipt.order?.course.title ?? receipt.channelPayment?.subscription.product.title ?? receipt.serviceName;
      return {
        id: receipt.id,
        telegramId: receipt.user.telegramId,
        username: receipt.user.username,
        name: [receipt.user.firstName, receipt.user.lastName].filter(Boolean).join(" ") || null,
        product,
        amountKopecks: receipt.amountKopecks,
        currency: receipt.currency,
        paidAt: receipt.operationAt.toISOString(),
        status: receipt.status,
        receiptUrl: receipt.printUrl,
        lastError: operation?.lastErrorRedacted ?? null,
      };
    });
  }

  @Get("users/:telegramId/access")
  accessForUser(@Param("telegramId") telegramId: string) {
    return this.prisma.courseAccess.findMany({
      where: { user: { telegramId } },
      include: { course: true },
      orderBy: { grantedAt: "desc" },
    });
  }

  @Get("users/by-username/:username")
  async userByUsername(@Param("username") username: string) {
    const normalizedUsername = username.replace(/^@/, "").trim();
    const user = await this.prisma.telegramUser.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { telegramId: true },
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
    await this.access.revoke({
      ...input,
      actor: request.adminActor ?? "admin",
    });
    return { ok: true };
  }

  @Post("channel-access/grant")
  async grantChannelAccess(@Req() request: any, @Body() body: unknown) {
    const input = AdminAccessMutationRequestSchema.pick({
      telegramId: true,
    }).parse(body);
    return this.channelAccess.grant(
      input.telegramId,
      request.adminActor ?? "admin",
    );
  }

  @Post("channel-access/revoke")
  async revokeChannelAccess(@Req() request: any, @Body() body: unknown) {
    const input = AdminAccessMutationRequestSchema.pick({
      telegramId: true,
    }).parse(body);
    await this.channelAccess.revoke(
      input.telegramId,
      request.adminActor ?? "admin",
    );
    return { ok: true };
  }
}
