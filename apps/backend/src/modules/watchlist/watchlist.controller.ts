import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTickerDto, UpdateTickerDto } from './watchlist.dto';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  async findAll(@Query('refresh') refresh?: string) {
    return this.watchlistService.findAll(refresh === 'true');
  }

  @Post()
  async create(@Body() dto: CreateTickerDto) {
    return this.watchlistService.create(dto);
  }

  @Patch(':symbol')
  async update(
    @Param('symbol') symbol: string,
    @Body() dto: UpdateTickerDto,
  ) {
    return this.watchlistService.update(symbol, dto);
  }

  @Delete(':symbol')
  async remove(@Param('symbol') symbol: string) {
    return this.watchlistService.remove(symbol);
  }
}
