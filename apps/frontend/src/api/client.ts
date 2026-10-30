import axios from 'axios';

const TOKEN_STORAGE_KEY = 'fast_stocks_access_token';

/**
 * Supports magic-link external access: https://host/?token=<SECRET>
 * Saves token to localStorage once and strips it from the browser address bar.
 */
export function ingestTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const urlToken = url.searchParams.get('token');
  if (urlToken && urlToken.trim()) {
    localStorage.setItem(TOKEN_STORAGE_KEY, urlToken.trim());
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}

export function getStoredAccessToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) {
    localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 20_000,
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers['X-Access-Token'] = token;
  }
  return config;
});

export interface TickerDto {
  id: number;
  symbol: string;
  name: string;
  exchange: string | null;
  assetType: string;
  newsQuery: string | null;
  notes: string | null;
  sortOrder: number;
  lastPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  currency: string | null;
  marketState: string | null;
  quoteUpdatedAt: string | null;
}

export interface QuoteDto {
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

export interface CandleDto {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponseDto {
  symbol: string;
  interval: '15m' | '1h' | '1d' | '1wk';
  range: '5d' | '1mo' | '3mo' | '6mo' | '1y';
  currency: string;
  candles: CandleDto[];
}

export interface NewsArticleDto {
  id: string;
  tickerSymbol: string;
  title: string;
  url: string;
  sourceName: string;
  sourceUrl: string | null;
  snippet: string | null;
  lang: 'ru' | 'en';
  publishedAt: string;
}

export interface NewsResponseDto {
  symbol: string;
  lang: 'ru' | 'en';
  queryUsed: string;
  providerUsed?: string;
  lastFetchedAt: string | null;
  fromCache: boolean;
  warning?: string;
  items: NewsArticleDto[];
}

export interface SearchTickerDto {
  symbol: string;
  name: string;
  exchange: string | null;
  assetType: string;
}

export const api = {
  async getWatchlist(refresh = false): Promise<TickerDto[]> {
    const { data } = await apiClient.get<TickerDto[]>('/watchlist', {
      params: refresh ? { refresh: 'true' } : undefined,
    });
    return data;
  },

  async addTicker(payload: {
    symbol: string;
    name?: string;
    exchange?: string | null;
    assetType?: string;
    newsQuery?: string;
    notes?: string;
  }): Promise<TickerDto> {
    const { data } = await apiClient.post<TickerDto>('/watchlist', payload);
    return data;
  },

  async updateTicker(
    symbol: string,
    payload: { name?: string; newsQuery?: string; notes?: string },
  ): Promise<TickerDto> {
    const { data } = await apiClient.patch<TickerDto>(
      `/watchlist/${encodeURIComponent(symbol)}`,
      payload,
    );
    return data;
  },

  async removeTicker(symbol: string): Promise<void> {
    await apiClient.delete(`/watchlist/${encodeURIComponent(symbol)}`);
  },

  async searchTickers(query: string): Promise<SearchTickerDto[]> {
    const { data } = await apiClient.get<SearchTickerDto[]>('/stocks/search', {
      params: { q: query },
    });
    return data;
  },

  async getQuote(symbol: string, refresh = false): Promise<QuoteDto> {
    const { data } = await apiClient.get<QuoteDto>(
      `/stocks/${encodeURIComponent(symbol)}/quote`,
      { params: refresh ? { refresh: 'true' } : undefined },
    );
    return data;
  },

  async getCandles(
    symbol: string,
    interval: string,
    range: string,
    refresh = false,
  ): Promise<CandlesResponseDto> {
    const { data } = await apiClient.get<CandlesResponseDto>(
      `/stocks/${encodeURIComponent(symbol)}/candles`,
      {
        params: {
          interval,
          range,
          ...(refresh ? { refresh: 'true' } : {}),
        },
      },
    );
    return data;
  },

  async getNews(
    symbol: string,
    lang: 'ru' | 'en',
    refresh = false,
  ): Promise<NewsResponseDto> {
    const { data } = await apiClient.get<NewsResponseDto>(
      `/news/${encodeURIComponent(symbol)}`,
      {
        params: {
          lang,
          ...(refresh ? { refresh: 'true' } : {}),
        },
      },
    );
    return data;
  },
};
