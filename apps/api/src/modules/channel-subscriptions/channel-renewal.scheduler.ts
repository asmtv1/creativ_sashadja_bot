import { ChannelSubscriptionNotificationsService } from "./channel-subscription-notifications.service";
import { ChannelExpiryService } from "./channel-expiry.service";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

@Injectable()
export class ChannelRenewalScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelRenewalScheduler.name);
  private timer?: NodeJS.Timeout;
  constructor(private readonly subscriptions: ChannelSubscriptionsService, private readonly expiry: ChannelExpiryService, private readonly notifications: ChannelSubscriptionNotificationsService) {}

  onModuleInit() {
    // A deployment must not leave a historical backlog idle for another 15 minutes.
    // The expiry worker has its own opt-in flag, 25-row batch and cross-instance
    // transaction locks, so this startup pass is subject to the same safeguards.
    void this.notifications.queueDue().catch((error: unknown) => this.logger.error(`Initial subscription notification check failed: ${error instanceof Error ? error.message : "unknown"}`));
    void this.expiry.runOnce().catch((error: unknown) =>
      this.logger.error(`Initial expiry check failed: ${error instanceof Error ? error.message : "unknown"}`),
    );
    this.timer = setInterval(() => {
      void Promise.allSettled([
        this.subscriptions.runRenewals(),
        this.subscriptions.reconcilePendingInitialPayments(),
        this.expiry.runOnce(),
        this.notifications.queueDue(),
      ]).then((results) => {
        for (const [index, result] of results.entries()) {
          if (result.status === "rejected") {
            this.logger.error(`Subscription scheduled task ${index} failed: ${result.reason instanceof Error ? result.reason.message : "unknown"}`);
          }
        }
      });
    }, 15 * 60_000);
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
