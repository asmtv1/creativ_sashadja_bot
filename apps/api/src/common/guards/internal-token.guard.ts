import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expected = this.config.get<string>("INTERNAL_API_TOKEN");
    const actual = request.headers["x-internal-token"];

    if (!expected || actual !== expected) {
      throw new UnauthorizedException("Invalid internal token");
    }

    return true;
  }
}
