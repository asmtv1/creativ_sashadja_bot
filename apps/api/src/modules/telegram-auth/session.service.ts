import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";

export type MiniAppSession = {
  userId: string;
  telegramId: string;
};

@Injectable()
export class SessionService {
  constructor(private readonly config: ConfigService) {}

  sign(session: MiniAppSession): string {
    return jwt.sign(
      {
        sub: session.userId,
        telegramId: session.telegramId
      },
      this.secret,
      {
        expiresIn: this.config.get<number>("MINIAPP_SESSION_TTL_SECONDS") ?? 1800
      }
    );
  }

  verify(token: string): MiniAppSession {
    try {
      const payload = jwt.verify(token, this.secret) as jwt.JwtPayload;
      if (!payload.sub || typeof payload.telegramId !== "string") {
        throw new Error("Invalid session payload");
      }
      return { userId: String(payload.sub), telegramId: payload.telegramId };
    } catch {
      throw new UnauthorizedException("Invalid Mini App session");
    }
  }

  private get secret(): string {
    const secret = this.config.get<string>("MINIAPP_SESSION_SECRET");
    if (!secret) {
      throw new Error("MINIAPP_SESSION_SECRET is required");
    }
    return secret;
  }
}
