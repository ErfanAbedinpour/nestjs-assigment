import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

type RequestWithHeader = {
  header: (name: string) => string | undefined;
};

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithHeader>();
    const provided = request.header('x-admin-api-key') ?? '';
    const expected = this.config.getOrThrow<string>('admin.apiKey');
    if (!safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid admin API key');
    }
    return true;
  }
}

function safeEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
