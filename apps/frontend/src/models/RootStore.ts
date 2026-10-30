import axios from 'axios';
import { cast, flow, Instance, types } from 'mobx-state-tree';
import {
  api,
  CandlesResponseDto,
  NewsResponseDto,
  QuoteDto,
  SearchTickerDto,
  setStoredAccessToken,
  TickerDto,
} from '../api/client';
import {
  CandleModel,
  INewsItemModel,
  NewsItemModel,
  QuoteDetailModel,
  SearchResultModel,
} from './MarketModels';
import { ITickerModel, TickerModel } from './TickerModel';

export type TimeframeInterval = '15m' | '1h' | '1d' | '1wk';
export type TimeframeRange = '5d' | '1mo' | '3mo' | '6mo' | '1y';
export type NewsLang = 'ru' | 'en';

function normalizeTickerDto(dto: TickerDto) {
  return {
    ...dto,
    currency: dto.currency || 'USD',
  };
}

export const RootStore = types
  .model('RootStore', {
    tickers: types.array(TickerModel),
    activeSymbol: types.optional(types.string, 'AAPL'),
    interval: types.optional(
      types.enumeration<TimeframeInterval>(['15m', '1h', '1d', '1wk']),
      '1d',
    ),
    range: types.optional(
      types.enumeration<TimeframeRange>(['5d', '1mo', '3mo', '6mo', '1y']),
      '3mo',
    ),
    candles: types.array(CandleModel),
    activeQuote: types.maybeNull(QuoteDetailModel),
    news: types.array(NewsItemModel),
    newsLang: types.optional(types.enumeration<NewsLang>(['ru', 'en']), 'ru'),
    newsQueryUsed: types.maybeNull(types.string),
    newsProviderUsed: types.maybeNull(types.string),
    newsLastFetchedAt: types.maybeNull(types.string),
    newsFromCache: types.optional(types.boolean, false),
    newsWarning: types.maybeNull(types.string),
    selectedDateKey: types.maybeNull(types.string),
    hoveredDateKey: types.maybeNull(types.string),
    searchResults: types.array(SearchResultModel),
    isSearching: types.optional(types.boolean, false),
    isLoadingWatchlist: types.optional(types.boolean, false),
    isLoadingMarket: types.optional(types.boolean, false),
    isLoadingNews: types.optional(types.boolean, false),
    isSavingSettings: types.optional(types.boolean, false),
    authRequiredError: types.optional(types.boolean, false),
    errorMessage: types.maybeNull(types.string),
  })
  .views((self) => ({
    get activeTicker(): ITickerModel | undefined {
      return self.tickers.find((t) => t.symbol === self.activeSymbol);
    },

    get newsCountByDate(): Record<string, number> {
      const counts: Record<string, number> = {};
      for (const item of self.news) {
        if (!item.dateKey) continue;
        counts[item.dateKey] = (counts[item.dateKey] || 0) + 1;
      }
      return counts;
    },

    get filteredNews(): INewsItemModel[] {
      if (!self.selectedDateKey) {
        return self.news.slice();
      }
      const exact = self.news.filter((n) => n.dateKey === self.selectedDateKey);
      if (exact.length > 0) {
        return exact;
      }
      // Fallback: show ±1 day window around selected candle if exact date has 0 articles
      const targetMs = new Date(`${self.selectedDateKey}T12:00:00Z`).getTime();
      const windowMs = 36 * 3600 * 1000;
      return self.news.filter(
        (n) => Math.abs(n.timestampMs - targetMs) <= windowMs,
      );
    },

    get isExactDateMatch(): boolean {
      if (!self.selectedDateKey) return true;
      return self.news.some((n) => n.dateKey === self.selectedDateKey);
    },

    get periodStats() {
      if (self.candles.length < 2) {
        return null;
      }
      const first = self.candles[0];
      const last = self.candles[self.candles.length - 1];
      let high = -Infinity;
      let low = Infinity;
      for (const c of self.candles) {
        if (c.high > high) high = c.high;
        if (c.low < low) low = c.low;
      }
      const diff = last.close - first.open;
      const pct = first.open !== 0 ? (diff / first.open) * 100 : 0;
      return {
        firstOpen: first.open,
        lastClose: last.close,
        diff,
        pct,
        high,
        low,
      };
    },
  }))
  .actions((self) => {
    const handleApiError = (err: unknown, fallbackMsg: string) => {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          self.authRequiredError = true;
          self.errorMessage =
            'Доступ защищен токеном. Введите секретный токен доступа.';
          return;
        }
        const serverMsg =
          err.response?.data?.message || err.message || fallbackMsg;
        self.errorMessage = Array.isArray(serverMsg)
          ? serverMsg.join(', ')
          : String(serverMsg);
        return;
      }
      self.errorMessage = fallbackMsg;
    };

    const loadWatchlist = flow(function* (refresh = false) {
      self.isLoadingWatchlist = true;
      try {
        const list: TickerDto[] = yield api.getWatchlist(refresh);
        self.tickers = cast(list.map(normalizeTickerDto));
        self.authRequiredError = false;
        if (
          self.tickers.length > 0 &&
          !self.tickers.some((t) => t.symbol === self.activeSymbol)
        ) {
          self.activeSymbol = self.tickers[0].symbol;
        }
      } catch (err) {
        handleApiError(err, 'Не удалось загрузить список тикеров');
      } finally {
        self.isLoadingWatchlist = false;
      }
    });

    const loadMarketData = flow(function* (forceRefresh = false) {
      if (!self.activeSymbol) return;
      const targetSymbol = self.activeSymbol;
      self.isLoadingMarket = true;
      self.errorMessage = null;
      try {
        const [quoteRes, candlesRes]: [QuoteDto, CandlesResponseDto] =
          yield Promise.all([
            api.getQuote(targetSymbol, forceRefresh),
            api.getCandles(
              targetSymbol,
              self.interval,
              self.range,
              forceRefresh,
            ),
          ]);

        if (self.activeSymbol !== targetSymbol) return;

        self.activeQuote = cast(quoteRes);
        self.range = candlesRes.range;
        self.candles = cast(candlesRes.candles);
        self.authRequiredError = false;

        // Sync fresh quote back into sidebar ticker item
        const tickerItem = self.tickers.find((t) => t.symbol === targetSymbol);
        if (tickerItem && quoteRes.price != null) {
          tickerItem.lastPrice = quoteRes.price;
          tickerItem.change = quoteRes.change;
          tickerItem.changePercent = quoteRes.changePercent;
          tickerItem.currency = quoteRes.currency || tickerItem.currency;
          tickerItem.marketState = quoteRes.marketState;
        }
      } catch (err) {
        handleApiError(
          err,
          `Ошибка загрузки рыночных данных для ${targetSymbol}`,
        );
      } finally {
        if (self.activeSymbol === targetSymbol) {
          self.isLoadingMarket = false;
        }
      }
    });

    const loadNews = flow(function* (forceRefresh = false) {
      if (!self.activeSymbol) return;
      const targetSymbol = self.activeSymbol;
      const targetLang = self.newsLang;
      self.isLoadingNews = true;
      try {
        const res: NewsResponseDto = yield api.getNews(
          targetSymbol,
          targetLang,
          forceRefresh,
        );
        if (self.activeSymbol !== targetSymbol || self.newsLang !== targetLang) {
          return;
        }
        self.news = cast(res.items);
        self.newsQueryUsed = res.queryUsed;
        self.newsProviderUsed = res.providerUsed || null;
        self.newsLastFetchedAt = res.lastFetchedAt;
        self.newsFromCache = res.fromCache;
        self.newsWarning = res.warning || null;
      } catch (err) {
        handleApiError(err, `Ошибка загрузки новостей для ${targetSymbol}`);
      } finally {
        if (self.activeSymbol === targetSymbol) {
          self.isLoadingNews = false;
        }
      }
    });

    const initialize = flow(function* () {
      yield loadWatchlist(false);
      if (self.activeSymbol && !self.authRequiredError) {
        yield Promise.all([loadMarketData(false), loadNews(false)]);
      }
    });

    const selectTicker = flow(function* (symbol: string) {
      const normalized = symbol.trim().toUpperCase();
      if (!normalized || normalized === self.activeSymbol) return;
      self.activeSymbol = normalized;
      self.selectedDateKey = null;
      self.hoveredDateKey = null;
      yield Promise.all([loadMarketData(false), loadNews(false)]);
    });

    const setInterval = flow(function* (nextInterval: TimeframeInterval) {
      if (self.interval === nextInterval) return;
      self.interval = nextInterval;
      if (nextInterval === '15m' && !['5d', '1mo'].includes(self.range)) {
        self.range = '5d';
      } else if (nextInterval === '1wk' && self.range === '5d') {
        self.range = '1y';
      }
      yield loadMarketData(false);
    });

    const setRange = flow(function* (nextRange: TimeframeRange) {
      if (self.range === nextRange) return;
      self.range = nextRange;
      if (
        self.interval === '15m' &&
        (nextRange === '3mo' || nextRange === '6mo' || nextRange === '1y')
      ) {
        self.interval = '1h';
      }
      yield loadMarketData(false);
    });

    const setNewsLang = flow(function* (lang: NewsLang) {
      if (self.newsLang === lang) return;
      self.newsLang = lang;
      yield loadNews(false);
    });

    const refreshAll = flow(function* () {
      yield Promise.all([
        loadWatchlist(true),
        loadMarketData(true),
        loadNews(true),
      ]);
    });

    const searchTickersAction = flow(function* (query: string) {
      const trimmed = query.trim();
      if (trimmed.length < 1) {
        self.searchResults = cast([]);
        return;
      }
      self.isSearching = true;
      try {
        const results: SearchTickerDto[] = yield api.searchTickers(trimmed);
        self.searchResults = cast(results);
      } catch (err) {
        handleApiError(err, 'Ошибка поиска тикеров');
      } finally {
        self.isSearching = false;
      }
    });

    const addTickerToWatchlist = flow(function* (payload: {
      symbol: string;
      name?: string;
      exchange?: string | null;
      assetType?: string;
      newsQuery?: string;
      notes?: string;
    }) {
      self.errorMessage = null;
      try {
        const created: TickerDto = yield api.addTicker(payload);
        const exists = self.tickers.find((t) => t.symbol === created.symbol);
        if (!exists) {
          self.tickers.push(normalizeTickerDto(created));
        }
        self.searchResults = cast([]);
        self.activeSymbol = created.symbol;
        self.selectedDateKey = null;
        yield Promise.all([loadMarketData(false), loadNews(false)]);
        return true;
      } catch (err) {
        handleApiError(err, `Не удалось добавить тикер ${payload.symbol}`);
        return false;
      }
    });

    const saveTickerSettings = flow(function* (
      symbol: string,
      payload: { newsQuery?: string; notes?: string },
    ) {
      self.isSavingSettings = true;
      try {
        const updated: TickerDto = yield api.updateTicker(symbol, payload);
        const idx = self.tickers.findIndex((t) => t.symbol === updated.symbol);
        if (idx !== -1) {
          self.tickers[idx] = cast(normalizeTickerDto(updated));
        }
        if (payload.newsQuery !== undefined && self.activeSymbol === symbol) {
          yield loadNews(true);
        }
        return true;
      } catch (err) {
        handleApiError(err, 'Не удалось сохранить настройки тикера');
        return false;
      } finally {
        self.isSavingSettings = false;
      }
    });

    const removeTickerFromWatchlist = flow(function* (symbol: string) {
      try {
        yield api.removeTicker(symbol);
        const remaining = self.tickers.filter((t) => t.symbol !== symbol);
        self.tickers = cast(remaining);
        if (self.activeSymbol === symbol) {
          const next = self.tickers[0]?.symbol || '';
          self.activeSymbol = next;
          self.selectedDateKey = null;
          if (next) {
            yield Promise.all([loadMarketData(false), loadNews(false)]);
          } else {
            self.candles = cast([]);
            self.news = cast([]);
            self.activeQuote = null;
          }
        }
      } catch (err) {
        handleApiError(err, `Не удалось удалить тикер ${symbol}`);
      }
    });

    const submitAccessToken = flow(function* (token: string) {
      setStoredAccessToken(token);
      self.authRequiredError = false;
      self.errorMessage = null;
      yield initialize();
    });

    return {
      initialize,
      loadWatchlist,
      loadMarketData,
      loadNews,
      selectTicker,
      setInterval,
      setRange,
      setNewsLang,
      refreshAll,
      searchTickersAction,
      addTickerToWatchlist,
      saveTickerSettings,
      removeTickerFromWatchlist,
      submitAccessToken,
      clearSearch() {
        self.searchResults = cast([]);
      },
      setSelectedDateKey(dateKey: string | null) {
        self.selectedDateKey =
          self.selectedDateKey === dateKey ? null : dateKey;
      },
      setHoveredDateKey(dateKey: string | null) {
        self.hoveredDateKey = dateKey;
      },
      dismissError() {
        self.errorMessage = null;
      },
    };
  });

export type IRootStore = Instance<typeof RootStore>;

export function createRootStore(): IRootStore {
  return RootStore.create({});
}
