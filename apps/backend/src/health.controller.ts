import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  check() {
    const tokenConfigured = Boolean(
      (this.configService.get<string>('APP_ACCESS_TOKEN') ?? '').trim(),
    );
    return {
      status: 'ok',
      authRequired: tokenConfigured,
      timestamp: new Date().toISOString(),
    };
  }
}
