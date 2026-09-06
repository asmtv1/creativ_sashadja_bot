export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED"
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentProvider = {
  YOOKASSA: "YOOKASSA",
  TELEGRAM_STARS: "TELEGRAM_STARS"
} as const;

export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  CANCELED: "CANCELED",
  REFUNDED: "REFUNDED"
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const AccessSource = {
  PAYMENT: "PAYMENT",
  ADMIN: "ADMIN"
} as const;

export type AccessSource = (typeof AccessSource)[keyof typeof AccessSource];

export const OutboxStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED"
} as const;

export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus];

export const OutboxType = {
  CHANNEL_INVITE: "CHANNEL_INVITE",
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  NPD_RECEIPT_ISSUED: "NPD_RECEIPT_ISSUED",
  ACCESS_GRANTED: "ACCESS_GRANTED",
  ACCESS_REVOKED: "ACCESS_REVOKED"
} as const;

export type OutboxType = (typeof OutboxType)[keyof typeof OutboxType];

export const WebhookStatus = {
  RECEIVED: "RECEIVED",
  PROCESSED: "PROCESSED",
  IGNORED: "IGNORED",
  FAILED: "FAILED"
} as const;

export type WebhookStatus = (typeof WebhookStatus)[keyof typeof WebhookStatus];

export const ChannelSubscriptionStatus = {
  PENDING: "PENDING", ACTIVE: "ACTIVE", PAST_DUE: "PAST_DUE",
  CANCELED_AT_PERIOD_END: "CANCELED_AT_PERIOD_END", EXPIRED: "EXPIRED", REFUNDED: "REFUNDED"
} as const;
export type ChannelSubscriptionStatus = (typeof ChannelSubscriptionStatus)[keyof typeof ChannelSubscriptionStatus];

export const ChannelPaymentStatus = {
  PENDING: "PENDING", SUCCEEDED: "SUCCEEDED", CANCELED: "CANCELED", FAILED: "FAILED", REFUNDED: "REFUNDED"
} as const;
export type ChannelPaymentStatus = (typeof ChannelPaymentStatus)[keyof typeof ChannelPaymentStatus];
