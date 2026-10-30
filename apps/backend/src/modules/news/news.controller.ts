import { Controller, Get, Param, Query } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get(':symbol')
  async getBySymbol(
    @Param('symbol') symbol: string,
    @Query('lang') lang = 'ru',
    @Query('refresh') refresh?: string,
  ) {
    return this.newsService.getNewsForTicker(
      symbol,
      lang,
      refresh === 'true',
    );
  }
}
