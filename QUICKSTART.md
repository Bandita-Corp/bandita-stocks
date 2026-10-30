# Fast Stocks — Руководство по быстрому старту (Quickstart)

## Структура проекта (Monorepo)
```text
fast-stocks/
├── apps/
│   ├── backend/          # Nest.js приложение
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── stocks/      # Yahoo Finance сервис и контроллер
│   │   │   │   ├── news/        # RSS-парсер (Google News)
│   │   │   │   └── watchlist/   # Управление списком тикеров
│   │   │   └── main.ts
│   │   └── package.json
│   └── frontend/         # React + Vite приложение
│       ├── src/
│       │   ├── components/
│       │   │   ├── CandlestickChart.tsx  # TradingView lightweight-charts
│       │   │   ├── NewsFeed.tsx          # Список новостей с бейджами
│       │   │   └── Watchlist.tsx         # Список избранных тикеров
│       │   ├── models/                   # MobX-State-Tree сторы
│       │   └── App.tsx
│       └── package.json
└── package.json
```

---

## 1. Настройка Backend (Nest.js)

### Установка зависимостей:
```bash
cd apps/backend
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/schedule
npm install yahoo-finance2 rss-parser
npm install prisma @prisma/client
npm install --save-dev @types/node typescript
```

### Пример реализации News Service (Google News RSS):
```typescript
import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';

@Injectable()
export class NewsService {
  private parser = new Parser();

  async getNewsForTicker(ticker: string, query?: string) {
    const searchTerm = encodeURIComponent(query || `${ticker} stock`);
    const url = `https://news.google.com/rss/search?q=${searchTerm}&hl=ru&gl=RU&ceid=RU:ru`;
    
    const feed = await this.parser.parseURL(url);
    return feed.items.map(item => ({
      id: item.guid || item.link,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: item.creator || 'Google News',
      snippet: item.contentSnippet,
    }));
  }
}
```

### Пример реализации Stocks Service (Yahoo Finance):
```typescript
import { Injectable } from '@nestjs/common';
import yahooFinance from 'yahoo-finance2';

@Injectable()
export class StocksService {
  async getQuote(ticker: string) {
    return await yahooFinance.quote(ticker);
  }

  async getHistoricalCandles(ticker: string, period1: string, interval: '1m' | '5m' | '1d' = '1d') {
    const queryOptions = { period1, interval };
    const result = await yahooFinance.historical(ticker, queryOptions);
    return result.map(c => ({
      time: Math.floor(new Date(c.date).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }
}
```

---

## 2. Настройка Frontend (React + MobX-State-Tree)

### Установка зависимостей:
```bash
cd apps/frontend
npm install mobx mobx-react-lite mobx-state-tree
npm install lightweight-charts lucide-react axios
npm install -D tailwindcss postcss autoprefixer
```

### Описание модели MST (`src/models/RootStore.ts`):
```typescript
import { types, flow } from 'mobx-state-tree';
import axios from 'axios';

export const CandleModel = types.model('Candle', {
  time: types.number,
  open: types.number,
  high: types.number,
  low: types.number,
  close: types.number,
  volume: types.optional(types.number, 0),
});

export const NewsItemModel = types.model('NewsItem', {
  id: types.string,
  title: types.string,
  link: types.string,
  source: types.string,
  pubDate: types.string,
});

export const RootStore = types
  .model('RootStore', {
    activeTicker: types.optional(types.string, 'AAPL'),
    candles: types.array(CandleModel),
    news: types.array(NewsItemModel),
    isLoading: types.boolean,
  })
  .actions(self => ({
    setActiveTicker(ticker: string) {
      self.activeTicker = ticker;
      this.loadData(ticker);
    },
    loadData: flow(function* (ticker: string) {
      self.isLoading = true;
      try {
        const [candlesRes, newsRes] = yield Promise.all([
          axios.get(`/api/stocks/${ticker}/candles?interval=1d`),
          axios.get(`/api/news?ticker=${ticker}`),
        ]);
        self.candles = candlesRes.data;
        self.news = newsRes.data;
      } catch (err) {
        console.error('Failed to load stock data:', err);
      } finally {
        self.isLoading = false;
      }
    }),
  }));
```

### Подключение графика TradingView Lightweight Charts:
```typescript
import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export const CandlestickChart = ({ data }: { data: any[] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 480,
      layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#1f2434' }, horzLines: { color: '#1f2434' } },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candleSeries.setData(data);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />;
};
```
