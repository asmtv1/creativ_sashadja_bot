import { Module } from "@nestjs/common";
import { NpdReceiptsService } from "./npd-receipts.service";

@Module({ providers: [NpdReceiptsService], exports: [NpdReceiptsService] })
export class NpdReceiptsModule {}
