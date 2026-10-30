import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import YahooFinance from 'yahoo-finance2';
import { PrismaService } from '../../prisma/prisma.service';

export type CandleInterval = '15m' | '1h' | '1d' | '1wk';
export type CandleRange = '5d' | '1mo' | '3mo' | '6mo' | '1y';

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteSummaryDto {
  symbol: string;
  name: string;
  exchange: string | null;
  assetType: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  currency: string;
  marketState: string | null;
  updatedAt: string;
}

export interface TickerSearchResultDto {
  symbol: string;
  name: string;
  exchange: string | null;
  assetType: string;
}

const VALID_INTERVALS: CandleInterval[] = ['15m', '1h', '1d', '1wk'];
const VALID_RANGES: CandleRange[] = ['5d', '1mo', '3mo', '6mo', '1y'];

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);
  private readonly yf: any;
  private readonly quoteCache = new Map<
    string,
    { expiresAt: number; data: QuoteSummaryDto }
  >();
  private readonly candleCache = new Map<
    string,
    { expiresAt: number; data: { symbol: string; interval: CandleInterval; range: CandleRange; currency: string; candles: CandlePoint[] } }
  >();

  constructor(private readonly prisma: PrismaService) {
    const RawYF: any = YahooFinance;
    const opts = { suppressNotices: ['yahooSurvey', 'ripHistorical'] };
    this.yf =
      typeof RawYF === 'function'
        ? new RawYF(opts)
        : typeof RawYF?.default === 'function'
          ? new RawYF.default(opts)
          : RawYF;
  }

  async searchTickers(query: string): Promise<TickerSearchResultDto[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const result = await this.yf.search(trimmed, {
        quotesCount: 12,
        newsCount: 0,
      });

      const quotes: any[] = Array.isArray(result?.quotes) ? result.quotes : [];

      return quotes
        .filter((item) => typeof item?.symbol === 'string' && item.symbol.length > 0)
        .map((item) => ({
          symbol: String(item.symbol).toUpperCase(),
          name: String(item.longname || item.shortname || item.symbol),
          exchange: item.exchDisp || item.exchange || null,
          assetType: String(item.quoteType || 'EQUITY').toUpperCase(),
        }));
    } catch (error: any) {
      this.logger.warn(`Yahoo search failed for "${trimmed}": ${error?.message}`);
      throw new BadGatewayException(
        `Не удалось выполнить поиск тикеров через Yahoo Finance: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async getQuote(symbolInput: string, forceRefresh = false): Promise<QuoteSummaryDto> {
    const symbol = this.normalizeSymbol(symbolInput);
    const now = Date.now();
    const cached = this.quoteCache.get(symbol);

    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const raw = await this.yf.quote(symbol);
      if (!raw || (!raw.symbol && raw.regularMarketPrice == null)) {
        throw new NotFoundException(`Тикер "${symbol}" не найден в Yahoo Finance`);
      }

      const dto = this.mapQuote(symbol, raw);
      this.quoteCache.set(symbol, { expiresAt: now + 30_000, data: dto });

      await this.prisma.ticker
        .updateMany({
          where: { symbol },
          data: {
            lastPrice: dto.price,
            previousClose: dto.previousClose,
            change: dto.change,
            changePercent: dto.changePercent,
            volume: dto.volume,
            currency: dto.currency,
            marketState: dto.marketState,
            quoteUpdatedAt: new Date(),
          },
        })
        .catch((err) =>
          this.logger.debug(`Skipped DB quote sync for ${symbol}: ${err?.message}`),
        );

      return dto;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn(`Failed to fetch quote for ${symbol}: ${error?.message}`);
      throw new BadGatewayException(
        `Ошибка получения котировки для ${symbol}: ${error?.message || 'Yahoo Finance unavailable'}`,
      );
    }
  }

  async refreshQuotesForSymbols(symbols: string[]): Promise<void> {
    const cleanSymbols = Array.from(
      new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    );
    if (cleanSymbols.length === 0) {
      return;
    }

    try {
      const rawResult = await this.yf.quote(cleanSymbols);
      const list: any[] = Array.isArray(rawResult)
        ? rawResult
        : rawResult
          ? [rawResult]
          : [];

      const now = Date.now();
      await Promise.all(
        list.map(async (raw) => {
          if (!raw?.symbol) return;
          const sym = String(raw.symbol).toUpperCase();
          const dto = this.mapQuote(sym, raw);
          this.quoteCache.set(sym, { expiresAt: now + 30_000, data: dto });

          await this.prisma.ticker.updateMany({
            where: { symbol: sym },
            data: {
              lastPrice: dto.price,
              previousClose: dto.previousClose,
              change: dto.change,
              changePercent: dto.changePercent,
              volume: dto.volume,
              currency: dto.currency,
              marketState: dto.marketState,
              quoteUpdatedAt: new Date(),
            },
          });
        }),
      );
    } catch (error: any) {
      this.logger.warn(`Batch quote refresh warning: ${error?.message}`);
    }
  }

  async getCandles(
    symbolInput: string,
    intervalInput: string = '1d',
    rangeInput: string = '3mo',
    forceRefresh = false,
  ) {
    const symbol = this.normalizeSymbol(symbolInput);
    const interval: CandleInterval = VALID_INTERVALS.includes(
      intervalInput as CandleInterval,
    )
      ? (intervalInput as CandleInterval)
      : '1d';

    let range: CandleRange = VALID_RANGES.includes(rangeInput as CandleRange)
      ? (rangeInput as CandleRange)
      : '3mo';

    // Yahoo Finance restricts 15m history to last 60 days
    if (interval === '15m' && (range === '3mo' || range === '6mo' || range === '1y')) {
      range = '1mo';
    }

    const cacheKey = `${symbol}:${interval}:${range}`;
    const now = Date.now();
    const cached = this.candleCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    const period1 = this.computeStartDate(range);

    try {
      const chart = await this.yf.chart(symbol, {
        period1,
        period2: new Date(),
        interval,
      });

      const rawQuotes: any[] = Array.isArray(chart?.quotes) ? chart.quotes : [];
      const deduped = new Map<number, CandlePoint>();

      for (const item of rawQuotes) {
        if (
          !item?.date ||
          item.open == null ||
          item.high == null ||
          item.low == null ||
          item.close == null
        ) {
          continue;
        }

        const timestampSec = Math.floor(new Date(item.date).getTime() / 1000);
        if (!Number.isFinite(timestampSec) || timestampSec <= 0) {
          continue;
        }

        deduped.set(timestampSec, {
          time: timestampSec,
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
          volume: item.volume != null ? Number(item.volume) : 0,
        });
      }

      const candles = Array.from(deduped.values()).sort((a, b) => a.time - b.time);
      const payload = {
        symbol,
        interval,
        range,
        currency: String(chart?.meta?.currency || 'USD'),
        candles,
      };

      this.candleCache.set(cacheKey, {
        expiresAt: now + 60_000,
        data: payload,
      });

      return payload;
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch candles for ${symbol} (${interval}/${range}): ${error?.message}`,
      );
      throw new BadGatewayException(
        `Не удалось загрузить свечи Yahoo Finance для ${symbol}: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  private normalizeSymbol(symbolInput: string): string {
    const symbol = (symbolInput || '').trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9.^=-]{1,20}$/.test(symbol)) {
      throw new BadRequestException(`Некорректный формат тикера: "${symbolInput}"`);
    }
    return symbol;
  }

  private computeStartDate(range: CandleRange): Date {
    const now = new Date();
    const d = new Date(now);
    switch (range) {
      case '5d':
        d.setDate(d.getDate() - 7);
        break;
      case '1mo':
        d.setMonth(d.getMonth() - 1);
        break;
      case '3mo':
        d.setMonth(d.getMonth() - 3);
        break;
      case '6mo':
        d.setMonth(d.getMonth() - 6);
        break;
      case '1y':
        d.setFullYear(d.getFullYear() - 1);
        break;
    }
    return d;
  }

  private mapQuote(symbol: string, raw: any): QuoteSummaryDto {
    return {
      symbol: String(raw.symbol || symbol).toUpperCase(),
      name: String(raw.longName || raw.shortName || raw.displayName || symbol),
      exchange: raw.fullExchangeName || raw.exchange || null,
      assetType: String(raw.quoteType || 'EQUITY').toUpperCase(),
      price: raw.regularMarketPrice != null ? Number(raw.regularMarketPrice) : null,
      previousClose:
        raw.regularMarketPreviousClose != null
          ? Number(raw.regularMarketPreviousClose)
          : null,
      change: raw.regularMarketChange != null ? Number(raw.regularMarketChange) : null,
      changePercent:
        raw.regularMarketChangePercent != null
          ? Number(raw.regularMarketChangePercent)
          : null,
      dayHigh:
        raw.regularMarketDayHigh != null ? Number(raw.regularMarketDayHigh) : null,
      dayLow: raw.regularMarketDayLow != null ? Number(raw.regularMarketDayLow) : null,
      volume: raw.regularMarketVolume != null ? Number(raw.regularMarketVolume) : null,
      marketCap: raw.marketCap != null ? Number(raw.marketCap) : null,
      fiftyTwoWeekHigh:
        raw.fiftyTwoWeekHigh != null ? Number(raw.fiftyTwoWeekHigh) : null,
      fiftyTwoWeekLow:
        raw.fiftyTwoWeekLow != null ? Number(raw.fiftyTwoWeekLow) : null,
      currency: String(raw.currency || 'USD'),
      marketState: raw.marketState ? String(raw.marketState) : null,
      updatedAt: new Date().toISOString(),
    };
  }
}
