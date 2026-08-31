-- Temporarily enable the channel checkout for YooKassa recurring-SBP review.
-- Receipt operations are still persisted and can be processed after a provider is connected.
UPDATE "ChannelProduct"
SET "enabled" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'creative-ideas';
