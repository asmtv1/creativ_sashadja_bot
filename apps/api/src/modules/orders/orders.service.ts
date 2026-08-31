import { randomUUID } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@course/db";
import { CreateCourseCheckoutResponse } from "@course/shared";
import { CoursesService } from "../courses/courses.service";
import { PrismaService } from "../prisma/prisma.service";
import { YooKassaClient, YooKassaPayment } from "../yookassa/yookassa.client";

type PendingOrder = {
  id: string;
  userId: string;
  courseId: string;
  amountKopecks: number;
  currency: string;
  status: "PENDING";
  idempotenceKey: string;
  providerPaymentId: string | null;
  paymentUrl: string | null;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
    private readonly yookassa: YooKassaClient,
    private readonly config: ConfigService
  ) {}

  async createCheckoutForUser(
    userId: string,
    courseSlug: string
  ): Promise<CreateCourseCheckoutResponse> {
    const user = await this.prisma.telegramUser.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.createCheckout(user.id, user.telegramId, courseSlug);
  }

  async createCheckoutForTelegramUser(
    telegramId: string,
    courseSlug: string
  ): Promise<CreateCourseCheckoutResponse> {
    const user = await this.prisma.telegramUser.findUnique({ where: { telegramId } });
    if (!user) {
      throw new NotFoundException("Telegram user not found");
    }
    return this.createCheckout(user.id, user.telegramId, courseSlug);
  }

  async verifyCheckoutForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException("Order not found");
    }
    if (order.providerPaymentId) {
      await this.handleWebhook(order.providerPaymentId);
    }
    return { status: (await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status };
  }

  async handleWebhook(providerPaymentId: string) {
    const order = await this.prisma.order.findUnique({ where: { providerPaymentId } });
    if (!order || order.status !== "PENDING") {
      return;
    }
    const remote = await this.yookassa.getPayment(providerPaymentId);
    await this.applyRemotePayment(order, remote);
  }

  private async createCheckout(
    userId: string,
    telegramId: string,
    courseSlug: string
  ): Promise<CreateCourseCheckoutResponse> {
    const course = await this.prisma.course.findUnique({ where: { slug: courseSlug } });
    if (!course || !course.isPublished) {
      throw new NotFoundException("Course not found");
    }
    if (await this.courses.hasAccess(userId, course.id)) {
      return { alreadyPaid: true };
    }

    let order = (await this.prisma.order.findFirst({
      where: {
        userId,
        courseId: course.id,
        status: "PENDING",
        amountKopecks: course.priceKopecks,
        currency: course.currency
      },
      orderBy: { createdAt: "desc" }
    })) as PendingOrder | null;

    if (order?.providerPaymentId) {
      const remote = await this.yookassa.getPayment(order.providerPaymentId);
      await this.applyRemotePayment(order, remote);
      if (remote.status === "succeeded" && remote.paid) {
        return { alreadyPaid: true };
      }
      if (remote.status === "pending" && order.paymentUrl) {
        return { orderId: order.id, paymentUrl: order.paymentUrl };
      }
      order = null;
    }

    order ??= (await this.prisma.order.create({
      data: {
        userId,
        courseId: course.id,
        provider: "YOOKASSA",
        amountKopecks: course.priceKopecks,
        currency: course.currency,
        status: "PENDING",
        idempotenceKey: randomUUID()
      }
    })) as PendingOrder;

    const remote = await this.yookassa.createSbpPayment({
      idempotenceKey: order.idempotenceKey,
      amountKopecks: order.amountKopecks,
      currency: order.currency,
      returnUrl: new URL(
        "/?course_payment=checking",
        this.config.getOrThrow<string>("PUBLIC_BASE_URL")
      ).href,
      metadata: {
        kind: "course_order",
        orderId: order.id,
        userId,
        telegramId,
        courseSlug: course.slug
      }
    });
    if (!remote.confirmation?.confirmation_url) {
      throw new Error("YooKassa did not return a confirmation URL");
    }
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        providerPaymentId: remote.id,
        paymentUrl: remote.confirmation.confirmation_url
      }
    });
    return { orderId: order.id, paymentUrl: remote.confirmation.confirmation_url };
  }

  private async applyRemotePayment(
    order: PendingOrder | {
      id: string;
      userId: string;
      courseId: string;
      amountKopecks: number;
      currency: string;
    },
    remote: YooKassaPayment
  ) {
    if (
      remote.amount.value !==
        `${Math.floor(order.amountKopecks / 100)}.${String(order.amountKopecks % 100).padStart(2, "0")}` ||
      remote.amount.currency !== order.currency ||
      remote.metadata?.kind !== "course_order" ||
      remote.metadata?.orderId !== order.id ||
      remote.metadata?.userId !== order.userId ||
      remote.payment_method?.type !== "sbp"
    ) {
      throw new ForbiddenException("Payment verification failed");
    }

    if (remote.status === "canceled") {
      await this.prisma.$transaction([
        this.prisma.payment.upsert({
          where: { providerPaymentId: remote.id },
          update: { status: "CANCELED", rawPayload: remote as Prisma.InputJsonValue },
          create: {
            orderId: order.id,
            provider: "YOOKASSA",
            providerPaymentId: remote.id,
            status: "CANCELED",
            amountKopecks: order.amountKopecks,
            currency: order.currency,
            rawPayload: remote as Prisma.InputJsonValue
          }
        }),
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: "CANCELED", canceledAt: new Date() }
        })
      ]);
      return;
    }

    if (remote.status !== "succeeded" || !remote.paid) {
      return;
    }

    const paidAt = new Date();
    await this.prisma.$transaction([
      this.prisma.payment.upsert({
        where: { providerPaymentId: remote.id },
        update: {
          status: "SUCCEEDED",
          amountKopecks: order.amountKopecks,
          currency: order.currency,
          rawPayload: remote as Prisma.InputJsonValue
        },
        create: {
          orderId: order.id,
          provider: "YOOKASSA",
          providerPaymentId: remote.id,
          status: "SUCCEEDED",
          amountKopecks: order.amountKopecks,
          currency: order.currency,
          rawPayload: remote as Prisma.InputJsonValue
        }
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt, providerPaymentId: remote.id }
      }),
      this.prisma.courseAccess.upsert({
        where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
        update: { revokedAt: null, source: "PAYMENT", orderId: order.id, grantedAt: paidAt },
        create: { userId: order.userId, courseId: order.courseId, source: "PAYMENT", orderId: order.id }
      })
    ]);

    const notification = await this.prisma.botOutbox.findFirst({
      where: {
        telegramId: remote.metadata?.telegramId ?? "",
        type: "PAYMENT_SUCCEEDED",
        payload: { path: ["orderId"], equals: order.id }
      }
    });
    if (!notification && remote.metadata?.telegramId) {
      await this.prisma.botOutbox.create({
        data: {
          telegramId: remote.metadata.telegramId,
          type: "PAYMENT_SUCCEEDED",
          payload: { orderId: order.id }
        }
      });
    }
  }
}
