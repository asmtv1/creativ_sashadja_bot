import { Module } from "@nestjs/common";
import { AdminBasicGuard } from "../../common/guards/admin-basic.guard";
import { AdminAccessService } from "./admin-access.service";
import { AdminController } from "./admin.controller";
import { PrismaAdminAccessRepository } from "./prisma-admin-access.repository";

@Module({
  controllers: [AdminController],
  providers: [
    AdminBasicGuard,
    PrismaAdminAccessRepository,
    {
      provide: AdminAccessService,
      useFactory: (repository: PrismaAdminAccessRepository) => new AdminAccessService(repository),
      inject: [PrismaAdminAccessRepository]
    }
  ]
})
export class AdminModule {}
