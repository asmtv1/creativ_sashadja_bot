import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type UpsertTelegramUserInput = {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertTelegramUser(input: UpsertTelegramUserInput) {
    return this.prisma.telegramUser.upsert({
      where: { telegramId: input.telegramId },
      update: {
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        languageCode: input.languageCode ?? null
      },
      create: {
        telegramId: input.telegramId,
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        languageCode: input.languageCode ?? null
      }
    });
  }

  async findByTelegramId(telegramId: string) {
    return this.prisma.telegramUser.findUnique({ where: { telegramId } });
  }
}
