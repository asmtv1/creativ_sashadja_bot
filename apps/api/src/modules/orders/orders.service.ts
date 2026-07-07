import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@course/db";
import { CreateOrderResponse } from "@course/shared";
import { CoursesService } from "../courses/courses.service";
import { PrismaService } from "../prisma/prisma.service";

export type ValidateTelegramInvoicePaymentInput = {
  orderId: string;
  telegramId: string;
  amountKopecks: number;
  currency: string;
};

export type CompleteTelegramInvoicePaymentInput = ValidateTelegramInvoicePaymentInput & {
  providerPaymentChargeId: string;
  telegramPaymentChargeId: string;
  rawPayload: unknown;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService
  ) {}

  async createOrderForUser(userId: string, courseSlug: string): Promise<CreateOrderResponse> {
    const user = await this.prisma.telegramUser.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.createOrder(user.id, user.telegramId, courseSlug);
  }

  async createOrderForTelegramUser(telegramId: string, courseSlug: string) {
    const user = await this.prisma.telegramUser.findUnique({ where: { telegramId } });
    if (!user) {
      throw new NotFoundException("Telegram user not found");
    }
    return this.createOrder(user.id, user.telegramId, courseSlug);
  }

  async validateTelegramInvoicePayment(input: ValidateTelegramInvoicePaymentInput) {
    const order = await this.findTelegramInvoiceOrder(input.orderId);
    if (!order || order.user.telegramId !== input.telegramId) {
      return { ok: false, errorMessage: "Заказ не найден" };
    }
    if (order.status === "PAID") {
      return { ok: false, errorMessage: "Заказ уже оплачен" };
    }
    if (
      order.status !== "PENDING" ||
      order.amountKopecks !== input.amountKopecks ||
      order.currency !== input.currency
    ) {
      return { ok: false, errorMessage: "Данные платежа не совпадают с заказом" };
    }

    return { ok: true };
  }

  async completeTelegramInvoicePayment(input: CompleteTelegramInvoicePaymentInput) {
    const order = await this.findTelegramInvoiceOrder(input.orderId);
    if (!order || order.user.telegramId !== input.telegramId) {
      return { paid: false, status: "PENDING" as const };
    }

    if (order.status === "PAID") {
      return { paid: true, status: "PAID" as const };
    }

    const validation = await this.validateTelegramInvoicePayment(input);
    if (!validation.ok) {
      return { paid: false, status: "PENDING" as const };
    }

    await this.prisma.payment.upsert({
      where: { providerPaymentId: input.providerPaymentChargeId },
      update: {
        status: "SUCCEEDED",
        amountKopecks: input.amountKopecks,
        currency: input.currency,
        rawPayload: input.rawPayload as Prisma.InputJsonValue
      },
      create: {
        orderId: order.id,
        provider: "YOOKASSA",
        providerPaymentId: input.providerPaymentChargeId,
        status: "SUCCEEDED",
        amountKopecks: input.amountKopecks,
        currency: input.currency,
        rawPayload: input.rawPayload as Prisma.InputJsonValue
      }
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        providerPaymentId: input.providerPaymentChargeId
      }
    });

    await this.prisma.courseAccess.upsert({
      where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      update: { revokedAt: null, source: "PAYMENT", orderId: order.id, grantedAt: new Date() },
      create: { userId: order.userId, courseId: order.courseId, source: "PAYMENT", orderId: order.id }
    });

    return { paid: true, status: "PAID" as const };
  }

  private async createOrder(
    userId: string,
    telegramId: string,
    courseSlug: string
  ): Promise<CreateOrderResponse> {
    const course = await this.prisma.course.findUnique({ where: { slug: courseSlug } });
    if (!course || !course.isPublished) {
      throw new NotFoundException("Course not found");
    }
    if (await this.courses.hasAccess(userId, course.id)) {
      return { alreadyPaid: true };
    }

    const order = await this.prisma.order.create({
      data: {
        userId,
        courseId: course.id,
        provider: "YOOKASSA",
        amountKopecks: course.priceKopecks,
        currency: course.currency,
        status: "PENDING",
        idempotenceKey: randomUUID()
      }
    });

    return {
      orderId: order.id,
      status: "PENDING",
      invoicePayload: order.id,
      title: course.title,
      description: course.description,
      amountKopecks: course.priceKopecks,
      currency: course.currency
    };
  }

  private findTelegramInvoiceOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });
  }
}
