import { Injectable } from "@nestjs/common";
import type {
  ChannelPaymentKind,
  ChannelPaymentStatus,
  ChannelSubscriptionStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type SubscriptionWithHistory = {
  status: ChannelSubscriptionStatus;
  autoRenew: boolean;
  periodEnd: Date | null;
  nextChargeAt: Date | null;
  nextAttemptAt: Date | null;
  user: {
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  payments: Array<{
    id: string;
    kind: ChannelPaymentKind;
    status: ChannelPaymentStatus;
    amountKopecks: number;
    currency: string;
    createdAt: Date;
    paidAt: Date | null;
  }>;
};

export type RenewalState =
  | "RENEWED"
  | "AWAITING"
  | "NOT_RENEWED"
  | "PAYMENT_PROBLEM"
  | "AUTO_RENEW_OFF"
  | "REFUNDED";

/** A historical payment success, rather than the subscription flag, proves a purchase. */
export function presentChannelRenewal(sub: SubscriptionWithHistory, now: Date) {
  const successful = sub.payments.filter((payment) => payment.status === "SUCCEEDED");
  const purchased = sub.payments.filter((payment) =>
    payment.status === "SUCCEEDED" || payment.status === "REFUNDED",
  );
  // The user can buy again through checkout after expiry. That flow records
  // another INITIAL payment, so the second successful charge still counts as
  // a renewal even though its provider kind is INITIAL.
  const renewalCount = Math.max(successful.length - 1, 0);
  const sortedPaid = [...(successful.length ? successful : purchased)].sort(
    (a, b) => (a.paidAt ?? a.createdAt).getTime() - (b.paidAt ?? b.createdAt).getTime(),
  );
  const periodNotEnded = Boolean(sub.periodEnd && sub.periodEnd > now);
  // A failed pre-expiry renewal may set EXPIRED while the paid term still
  // runs. It is a payment problem, not grounds for early access removal.
  const active = periodNotEnded && (
    ["ACTIVE", "PAST_DUE", "CANCELED_AT_PERIOD_END"].includes(sub.status) ||
    (sub.status === "EXPIRED" && sub.autoRenew && successful.length > 0)
  );
  const state: RenewalState =
    sub.status === "REFUNDED"
      ? "REFUNDED"
      : sub.autoRenew && (sub.status === "PAST_DUE" || (sub.status === "EXPIRED" && periodNotEnded))
        ? "PAYMENT_PROBLEM"
        : !active
          ? "NOT_RENEWED"
          : !sub.autoRenew
            ? "AUTO_RENEW_OFF"
            : renewalCount
              ? "RENEWED"
              : "AWAITING";

  return {
    telegramId: sub.user.telegramId,
    username: sub.user.username,
    name: [sub.user.firstName, sub.user.lastName].filter(Boolean).join(" ") || null,
    state,
    active,
    autoRenew: sub.autoRenew,
    firstPaidAt: sortedPaid[0]?.paidAt?.toISOString() ?? sortedPaid[0]?.createdAt.toISOString() ?? null,
    lastPaidAt: sortedPaid.at(-1)?.paidAt?.toISOString() ?? sortedPaid.at(-1)?.createdAt.toISOString() ?? null,
    periodEnd: sub.periodEnd?.toISOString() ?? null,
    nextChargeAt: sub.autoRenew ? sub.nextChargeAt?.toISOString() ?? null : null,
    nextAttemptAt: sub.autoRenew ? sub.nextAttemptAt?.toISOString() ?? null : null,
    successfulRenewals: renewalCount,
    successfulPayments: successful.length,
    payments: [...sub.payments]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((payment) => ({
        id: payment.id,
        kind: payment.kind,
        status: payment.status,
        amountKopecks: payment.amountKopecks,
        currency: payment.currency,
        date: (payment.paidAt ?? payment.createdAt).toISOString(),
      })),
  };
}

@Injectable()
export class AdminChannelRenewalsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(now = new Date()) {
    const product = await this.prisma.channelProduct.findUniqueOrThrow({
      where: { slug: process.env.CHANNEL_PRODUCT_SLUG ?? "creative-ideas" },
    });
    const subscriptions = await this.prisma.channelSubscription.findMany({
      where: {
        productId: product.id,
        payments: { some: { status: { in: ["SUCCEEDED", "REFUNDED"] } } },
      },
      select: {
        status: true,
        autoRenew: true,
        periodEnd: true,
        nextChargeAt: true,
        nextAttemptAt: true,
        user: { select: { telegramId: true, username: true, firstName: true, lastName: true } },
        payments: {
          select: {
            id: true,
            kind: true,
            status: true,
            amountKopecks: true,
            currency: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });
    const users = subscriptions.map((sub) => presentChannelRenewal(sub, now));
    users.sort((a, b) => {
      if (a.state === "NOT_RENEWED" && b.state !== "NOT_RENEWED") return -1;
      if (b.state === "NOT_RENEWED" && a.state !== "NOT_RENEWED") return 1;
      return (a.periodEnd ?? "9999").localeCompare(b.periodEnd ?? "9999");
    });
    return {
      product: product.title,
      generatedAt: now.toISOString(),
      metrics: {
        total: users.length,
        active: users.filter((user) => user.active).length,
        renewedEver: users.filter((user) => user.successfulRenewals > 0).length,
        notRenewed: users.filter((user) => user.state === "NOT_RENEWED").length,
        paymentProblem: users.filter((user) => user.state === "PAYMENT_PROBLEM").length,
        autoRenewOff: users.filter((user) => user.state === "AUTO_RENEW_OFF").length,
      },
      users,
    };
  }
}
