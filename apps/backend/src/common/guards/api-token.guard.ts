import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = (
      this.configService.get<string>('APP_ACCESS_TOKEN') ?? ''
    ).trim();

    // Open single-user mode when APP_ACCESS_TOKEN is not configured
    if (!expectedToken) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (request.path === '/api/health') {
      return true;
    }

    const headerToken = request.headers['x-access-token'];
    const authHeader = request.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const queryToken =
      typeof request.query.token === 'string' ? request.query.token : undefined;

    const candidate = (
      (Array.isArray(headerToken) ? headerToken[0] : headerToken) ||
      bearerToken ||
      queryToken ||
      ''
    ).trim();

    if (!candidate || !this.safeEquals(candidate, expectedToken)) {
      throw new UnauthorizedException(
        'Требуется действительный токен доступа (X-Access-Token или ?token=...)',
      );
    }

    return true;
  }

  private safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
