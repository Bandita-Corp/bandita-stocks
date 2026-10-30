import { Instance, types } from 'mobx-state-tree';

export const TickerModel = types
  .model('Ticker', {
    id: types.number,
    symbol: types.identifier,
    name: types.string,
    exchange: types.maybeNull(types.string),
    assetType: types.optional(types.string, 'EQUITY'),
    newsQuery: types.maybeNull(types.string),
    notes: types.maybeNull(types.string),
    sortOrder: types.optional(types.number, 0),
    lastPrice: types.maybeNull(types.number),
    previousClose: types.maybeNull(types.number),
    change: types.maybeNull(types.number),
    changePercent: types.maybeNull(types.number),
    volume: types.maybeNull(types.number),
    currency: types.optional(types.string, 'USD'),
    marketState: types.maybeNull(types.string),
    quoteUpdatedAt: types.maybeNull(types.string),
  })
  .views((self) => ({
    get isPositive(): boolean {
      return (self.changePercent ?? 0) >= 0;
    },
    get formattedPrice(): string {
      if (self.lastPrice == null) return '—';
      return self.lastPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: self.lastPrice < 1 ? 4 : 2,
      });
    },
    get formattedChangePercent(): string {
      if (self.changePercent == null) return '—';
      const sign = self.changePercent >= 0 ? '+' : '';
      return `${sign}${self.changePercent.toFixed(2)}%`;
    },
  }));

export type ITickerModel = Instance<typeof TickerModel>;
