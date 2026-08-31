import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { OrdersModule } from "../orders/orders.module";
import { YooKassaModule } from "../yookassa/yookassa.module";
import { ChannelRenewalScheduler } from "./channel-renewal.scheduler";
import { ChannelSubscriptionsController } from "./channel-subscriptions.controller";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

@Module({ imports: [UsersModule, OrdersModule, YooKassaModule], controllers: [ChannelSubscriptionsController], providers: [ChannelSubscriptionsService, ChannelRenewalScheduler], exports: [ChannelSubscriptionsService] })
export class ChannelSubscriptionsModule {}
