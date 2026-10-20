import { ChannelTelegramMembersService } from "../channel-subscriptions/channel-telegram-members.service";
import { ChannelSubscriptionsModule } from "../channel-subscriptions/channel-subscriptions.module";
import { Module } from "@nestjs/common";
import { AdminBasicGuard } from "../../common/guards/admin-basic.guard";
import { AdminAccessService } from "./admin-access.service";
import { AdminController } from "./admin.controller";
import { PrismaAdminAccessRepository } from "./prisma-admin-access.repository";
import { AdminChannelAccessService } from "./admin-channel-access.service";
import { AdminChannelRenewalsService } from "./admin-channel-renewals.service";

@Module({
  imports: [ChannelSubscriptionsModule],
  controllers: [AdminController],
  providers: [
    AdminBasicGuard,
    PrismaAdminAccessRepository,
    AdminChannelAccessService,
    ChannelTelegramMembersService,
    AdminChannelRenewalsService,
    {
      provide: AdminAccessService,
      useFactory: (repository: PrismaAdminAccessRepository) =>
        new AdminAccessService(repository),
      inject: [PrismaAdminAccessRepository],
    },
  ],
})
export class AdminModule {}
