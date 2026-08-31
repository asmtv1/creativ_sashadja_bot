-- Screenshot-only subscription for @gafus_support (Telegram ID 8402560583).
-- The payment and saved-method identifiers below are deliberately synthetic and
-- never correspond to a YooKassa operation or a real payer.
WITH demo_subscription AS (
  INSERT INTO "ChannelSubscription" (
    "id", "userId", "productId", "status", "autoRenew", "paymentMethodId",
    "periodStart", "periodEnd", "nextChargeAt", "nextAttemptAt", "attemptCount",
    "termsVersion", "termsAcceptedAt", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(), u."id", p."id", 'ACTIVE', true,
    'demo_sbp_method_gafus_support_20260831',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days' - INTERVAL '4 hours', NULL, 0,
    '2026-08-31', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "TelegramUser" u
  JOIN "ChannelProduct" p ON p."slug" = 'creative-ideas'
  WHERE u."telegramId" = '8402560583'
  ON CONFLICT ("userId", "productId") DO UPDATE SET
    "status" = 'ACTIVE',
    "autoRenew" = true,
    "paymentMethodId" = 'demo_sbp_method_gafus_support_20260831',
    "periodStart" = CURRENT_TIMESTAMP,
    "periodEnd" = CURRENT_TIMESTAMP + INTERVAL '30 days',
    "nextChargeAt" = CURRENT_TIMESTAMP + INTERVAL '30 days' - INTERVAL '4 hours',
    "nextAttemptAt" = NULL,
    "attemptCount" = 0,
    "cancelRequestedAt" = NULL,
    "termsVersion" = '2026-08-31',
    "termsAcceptedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
  RETURNING "id"
)
INSERT INTO "ChannelPayment" (
  "id", "subscriptionId", "kind", "status", "amountKopecks", "currency",
  "providerPaymentId", "idempotenceKey", "paidAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), "id", 'INITIAL', 'SUCCEEDED', 39000, 'RUB',
  'demo_yookassa_payment_gafus_support_20260831',
  'demo_idempotence_gafus_support_20260831', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM demo_subscription
ON CONFLICT ("providerPaymentId") DO NOTHING;
