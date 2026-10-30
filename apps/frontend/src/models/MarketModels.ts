import { Instance, types } from 'mobx-state-tree';

export function unixSecToDateKey(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoToDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CandleModel = types
  .model('Candle', {
    time: types.number,
    open: types.number,
    high: types.number,
    low: types.number,
    close: types.number,
    volume: types.optional(types.number, 0),
  })
  .views((self) => ({
    get dateKey(): string {
      return unixSecToDateKey(self.time);
    },
  }));

export const QuoteDetailModel = types.model('QuoteDetail', {
  symbol: types.string,
  name: types.string,
  exchange: types.maybeNull(types.string),
  assetType: types.string,
  price: types.maybeNull(types.number),
  previousClose: types.maybeNull(types.number),
  change: types.maybeNull(types.number),
  changePercent: types.maybeNull(types.number),
  dayHigh: types.maybeNull(types.number),
  dayLow: types.maybeNull(types.number),
  volume: types.maybeNull(types.number),
  marketCap: types.maybeNull(types.number),
  fiftyTwoWeekHigh: types.maybeNull(types.number),
  fiftyTwoWeekLow: types.maybeNull(types.number),
  currency: types.string,
  marketState: types.maybeNull(types.string),
  updatedAt: types.string,
});

export const NewsItemModel = types
  .model('NewsItem', {
    id: types.string,
    tickerSymbol: types.string,
    title: types.string,
    url: types.string,
    sourceName: types.string,
    sourceUrl: types.maybeNull(types.string),
    snippet: types.maybeNull(types.string),
    lang: types.enumeration(['ru', 'en']),
    publishedAt: types.string,
  })
  .views((self) => ({
    get dateKey(): string {
      return isoToDateKey(self.publishedAt);
    },
    get timestampMs(): number {
      const t = new Date(self.publishedAt).getTime();
      return Number.isNaN(t) ? 0 : t;
    },
  }));

export const SearchResultModel = types.model('SearchResult', {
  symbol: types.string,
  name: types.string,
  exchange: types.maybeNull(types.string),
  assetType: types.string,
});

export type ICandleModel = Instance<typeof CandleModel>;
export type IQuoteDetailModel = Instance<typeof QuoteDetailModel>;
export type INewsItemModel = Instance<typeof NewsItemModel>;
export type ISearchResultModel = Instance<typeof SearchResultModel>;
