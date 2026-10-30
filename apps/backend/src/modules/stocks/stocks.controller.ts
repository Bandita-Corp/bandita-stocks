import { Controller, Get, Param, Query } from '@nestjs/common';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get('search')
  async search(@Query('q') query = '') {
    return this.stocksService.searchTickers(query);
  }

  @Get(':symbol/quote')
  async getQuote(
    @Param('symbol') symbol: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.stocksService.getQuote(symbol, refresh === 'true');
  }

  @Get(':symbol/candles')
  async getCandles(
    @Param('symbol') symbol: string,
    @Query('interval') interval = '1d',
    @Query('range') range = '3mo',
    @Query('refresh') refresh?: string,
  ) {
    return this.stocksService.getCandles(
      symbol,
      interval,
      range,
      refresh === 'true',
    );
  }
}
