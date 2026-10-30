import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StocksService } from '../stocks/stocks.service';
import { CreateTickerDto, UpdateTickerDto } from './watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stocksService: StocksService,
  ) {}

  async findAll(forceRefreshQuotes = false) {
    const tickers = await this.prisma.ticker.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const staleThreshold = Date.now() - 2 * 60_000;
    const needsRefresh =
      forceRefreshQuotes ||
      tickers.some(
        (t) => !t.quoteUpdatedAt || t.quoteUpdatedAt.getTime() < staleThreshold,
      );

    if (needsRefresh && tickers.length > 0) {
      await this.stocksService.refreshQuotesForSymbols(
        tickers.map((t) => t.symbol),
      );
      return this.prisma.ticker.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    }

    return tickers;
  }

  async create(dto: CreateTickerDto) {
    const symbol = dto.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.^=-]{1,20}$/.test(symbol)) {
      throw new BadRequestException(`Некорректный символ тикера: "${dto.symbol}"`);
    }

    const existing = await this.prisma.ticker.findUnique({
      where: { symbol },
    });
    if (existing) {
      return existing;
    }

    // Validate against Yahoo Finance and enrich quote fields
    const quote = await this.stocksService.getQuote(symbol, true);

    const maxOrderAgg = await this.prisma.ticker.aggregate({
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrderAgg._max.sortOrder ?? 0) + 1;

    const cleanName = (dto.name?.trim() || quote.name || symbol).trim();
    const defaultNewsQuery =
      dto.newsQuery?.trim() || this.buildDefaultNewsQuery(symbol, cleanName);

    return this.prisma.ticker.create({
      data: {
        symbol,
        name: cleanName,
        exchange: dto.exchange?.trim() || quote.exchange,
        assetType: dto.assetType?.trim() || quote.assetType || 'EQUITY',
        newsQuery: defaultNewsQuery,
        notes: dto.notes?.trim() || null,
        sortOrder: nextOrder,
        lastPrice: quote.price,
        previousClose: quote.previousClose,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        currency: quote.currency,
        marketState: quote.marketState,
        quoteUpdatedAt: new Date(),
      },
    });
  }

  async update(symbolInput: string, dto: UpdateTickerDto) {
    const symbol = symbolInput.trim().toUpperCase();
    const existing = await this.prisma.ticker.findUnique({ where: { symbol } });
    if (!existing) {
      throw new NotFoundException(`Тикер ${symbol} не найден в списке отслеживания`);
    }

    return this.prisma.ticker.update({
      where: { symbol },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || existing.name } : {}),
        ...(dto.newsQuery !== undefined
          ? { newsQuery: dto.newsQuery.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
  }

  async remove(symbolInput: string) {
    const symbol = symbolInput.trim().toUpperCase();
    const existing = await this.prisma.ticker.findUnique({ where: { symbol } });
    if (!existing) {
      throw new NotFoundException(`Тикер ${symbol} не найден`);
    }

    await this.prisma.ticker.delete({ where: { symbol } });
    return { deleted: true, symbol };
  }

  private buildDefaultNewsQuery(symbol: string, name: string): string {
    const stripped = name
      .replace(/\b(Inc\.?|Corp\.?|Corporation|Company|Co\.?|Ltd\.?|PLC|Holdings?|Group)\b/gi, '')
      .replace(/[.,]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!stripped || stripped.toUpperCase() === symbol) {
      return `${symbol} stock`;
    }
    return `"${stripped}" OR ${symbol}`;
  }
}
