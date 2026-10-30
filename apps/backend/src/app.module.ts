import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'path';
import { ApiTokenGuard } from './common/guards/api-token.guard';
import { HealthController } from './health.controller';
import { NewsModule } from './modules/news/news.module';
import { StocksModule } from './modules/stocks/stocks.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StocksModule,
    WatchlistModule,
    NewsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiTokenGuard,
    },
  ],
})
export class AppModule {}
