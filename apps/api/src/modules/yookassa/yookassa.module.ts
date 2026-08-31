import { Module } from "@nestjs/common";
import { YooKassaClient } from "./yookassa.client";

@Module({ providers: [YooKassaClient], exports: [YooKassaClient] })
export class YooKassaModule {}
