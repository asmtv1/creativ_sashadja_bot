import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

@Injectable()
export class ChannelRenewalScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly subscriptions: ChannelSubscriptionsService) {}
  onModuleInit() { this.timer = setInterval(() => void this.subscriptions.runRenewals().catch(() => undefined), 15 * 60_000); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
