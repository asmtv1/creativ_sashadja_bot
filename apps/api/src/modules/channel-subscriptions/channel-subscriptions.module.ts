import { ChannelExpiryService } from "./channel-expiry.service";
import { ChannelTelegramMembersService } from "./channel-telegram-members.service";
import { ChannelInvitesService } from "./channel-invites.service";
import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { OrdersModule } from "../orders/orders.module";
import { YooKassaModule } from "../yookassa/yookassa.module";
import { NpdReceiptsModule } from "../npd-receipts/npd-receipts.module";
import { ChannelRenewalScheduler } from "./channel-renewal.scheduler";
import { ChannelSubscriptionsController } from "./channel-subscriptions.controller";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

@Module({ imports: [UsersModule, OrdersModule, YooKassaModule, NpdReceiptsModule], controllers: [ChannelSubscriptionsController], providers: [ChannelInvitesService, ChannelSubscriptionsService, ChannelRenewalScheduler, ChannelExpiryService, ChannelTelegramMembersService], exports: [ChannelSubscriptionsService, ChannelExpiryService] })
export class ChannelSubscriptionsModule {}
