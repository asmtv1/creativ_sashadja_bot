import { ChannelExpiryService } from "./channel-expiry.service";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

@Injectable()
export class ChannelRenewalScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly subscriptions: ChannelSubscriptionsService, private readonly expiry: ChannelExpiryService) {}
  onModuleInit() {
    this.timer = setInterval(
      () =>
        void Promise.all([
          this.subscriptions.runRenewals(),
          this.subscriptions.reconcilePendingInitialPayments(),
          this.expiry.runOnce(),
        ]).catch(() => undefined),
      15 * 60_000,
    );
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
