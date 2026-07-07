import { Buffer } from "node:buffer";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminBasicGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith("Basic ")) {
      throw new UnauthorizedException("Admin credentials required");
    }

    const [user, password] = Buffer.from(header.slice("Basic ".length), "base64")
      .toString("utf8")
      .split(":");

    if (
      user !== this.config.get<string>("ADMIN_BASIC_USER") ||
      password !== this.config.get<string>("ADMIN_BASIC_PASSWORD")
    ) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    request.adminActor = user;
    return true;
  }
}
