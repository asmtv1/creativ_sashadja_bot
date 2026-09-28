import { Buffer } from "node:buffer";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "admin_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AdminBasicGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const header = request.headers.authorization as string | undefined;
    const user = this.config.get<string>("ADMIN_BASIC_USER");
    const password = this.config.get<string>("ADMIN_BASIC_PASSWORD");
    const secret = `${this.config.get<string>("MINIAPP_SESSION_SECRET")}:${password}`;

    if (header?.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator < 0 || decoded.slice(0, separator) !== user || decoded.slice(separator + 1) !== password) {
        throw new UnauthorizedException("Invalid admin credentials");
      }
      const token = jwt.sign({ sub: user }, secret, { audience: "admin", expiresIn: SESSION_SECONDS });
      response.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}`);
      request.adminActor = user;
      return true;
    }

    const cookie = (request.headers.cookie as string | undefined)?.split("; ").find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) throw new UnauthorizedException("Admin session required");
    try {
      const payload = jwt.verify(cookie.slice(COOKIE_NAME.length + 1), secret, { audience: "admin" }) as jwt.JwtPayload;
      if (payload.sub !== user) throw new Error("Invalid admin session");
    } catch {
      throw new UnauthorizedException("Invalid admin session");
    }

    request.adminActor = user;
    return true;
  }
}
