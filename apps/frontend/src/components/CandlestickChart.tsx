import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { CalendarSearch, Loader2, Newspaper } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useRef, useState } from 'react';
import { unixSecToDateKey } from '../models/MarketModels';
import { useStore } from '../models/StoreContext';

interface HoverLegend {
  dateLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  newsCount: number;
}

export const CandlestickChart: React.FC = observer(() => {
  const store = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const candleByTimeRef = useRef<
    Map<number, { open: number; high: number; low: number; close: number; volume: number }>
  >(new Map());
  const newsCountsRef = useRef<Record<string, number>>({});

  const [legend, setLegend] = useState<HoverLegend | null>(null);

  // Initialize TradingView Lightweight Chart v5 once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 460,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#161c28' },
        horzLines: { color: '#161c28' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#232a3b',
      },
      timeScale: {
        borderColor: '#232a3b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candleSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.08,
        bottom: 0.24,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const markersPlugin = createSeriesMarkers(candleSeries, []);

    chart.subscribeClick((param) => {
      if (typeof param.time === 'number') {
        const clickedDateKey = unixSecToDateKey(param.time);
        store.setSelectedDateKey(clickedDateKey);
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || typeof param.time !== 'number') {
        setLegend(null);
        return;
      }
      const c = candleByTimeRef.current.get(param.time);
      if (!c) {
        setLegend(null);
        return;
      }
      const dateKey = unixSecToDateKey(param.time);
      setLegend({
        dateLabel: new Date(param.time * 1000).toLocaleString('ru-RU', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          ...(store.interval === '15m' || store.interval === '1h'
            ? { hour: '2-digit', minute: '2-digit' }
            : {}),
        }),
        ...c,
        newsCount: newsCountsRef.current[dateKey] || 0,
      });
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      }
    });
    resizeObserver.observe(el);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markersPluginRef.current = markersPlugin;

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
    };
  }, [store]);

  // Update candle & volume series data cleanly using plain JS snapshots
  const plainCandles = store.candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    dateKey: c.dateKey,
  }));

  const newsCountMap = store.newsCountByDate;
  newsCountsRef.current = newsCountMap;

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) {
      return;
    }

    const lookup = new Map<
      number,
      { open: number; high: number; low: number; close: number; volume: number }
    >();

    for (const c of plainCandles) {
      lookup.set(c.time as number, {
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    }
    candleByTimeRef.current = lookup;

    candleSeriesRef.current.setData(
      plainCandles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volumeSeriesRef.current.setData(
      plainCandles.map((c) => ({
        time: c.time,
        value: c.volume,
        color:
          c.close >= c.open
            ? 'rgba(34, 197, 94, 0.32)'
            : 'rgba(239, 68, 68, 0.32)',
      })),
    );

    chartRef.current.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.activeSymbol, store.interval, store.range, plainCandles.length]);

  // Synchronize News Markers + Selected/Hovered Candle Highlights on Chart
  useEffect(() => {
    if (!markersPluginRef.current) return;

    // Pick representative candle timestamp per dateKey (last candle of that day)
    const lastCandleTimeByDate = new Map<string, UTCTimestamp>();
    for (const c of plainCandles) {
      lastCandleTimeByDate.set(c.dateKey, c.time);
    }

    const markers: SeriesMarker<Time>[] = [];

    for (const [dateKey, candleTime] of lastCandleTimeByDate.entries()) {
      const count = newsCountMap[dateKey] || 0;
      const isSelected = store.selectedDateKey === dateKey;
      const isHovered = store.hoveredDateKey === dateKey;

      if (isSelected) {
        markers.push({
          time: candleTime,
          position: 'aboveBar',
          color: '#f59e0b',
          shape: 'arrowDown',
          text: count > 0 ? `Фильтр (${count})` : 'Выбрано',
        });
      } else if (isHovered) {
        markers.push({
          time: candleTime,
          position: 'aboveBar',
          color: '#60a5fa',
          shape: 'arrowDown',
          text: count > 0 ? `Новости: ${count}` : dateKey,
        });
      } else if (count > 0) {
        markers.push({
          time: candleTime,
          position: 'aboveBar',
          color: '#38bdf8',
          shape: 'circle',
          text: `${count}`,
        });
      }
    }

    markers.sort((a, b) => Number(a.time) - Number(b.time));
    markersPluginRef.current.setMarkers(markers);
  }, [
    plainCandles,
    newsCountMap,
    store.selectedDateKey,
    store.hoveredDateKey,
  ]);

  const latestCandle =
    plainCandles.length > 0 ? plainCandles[plainCandles.length - 1] : null;
  const activeLegend =
    legend ||
    (latestCandle
      ? {
          dateLabel: new Date(
            Number(latestCandle.time) * 1000,
          ).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
          volume: latestCandle.volume,
          newsCount: newsCountMap[latestCandle.dateKey] || 0,
        }
      : null);

  return (
    <div className="relative flex-1 min-h-[380px] bg-terminal-bg flex flex-col">
      {/* Floating OHLCV & News Correlation Overlay */}
      <div className="absolute top-2.5 left-3 right-3 z-10 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {activeLegend && (
          <div className="bg-terminal-panel/85 backdrop-blur px-2.5 py-1 rounded border border-terminal-border/80 text-[11px] font-mono flex flex-wrap items-center gap-3 text-slate-300">
            <span className="text-slate-400 font-sans">
              {activeLegend.dateLabel}
            </span>
            <span>
              O <strong className="text-slate-100">{activeLegend.open.toFixed(2)}</strong>
            </span>
            <span>
              H <strong className="text-emerald-400">{activeLegend.high.toFixed(2)}</strong>
            </span>
            <span>
              L <strong className="text-rose-400">{activeLegend.low.toFixed(2)}</strong>
            </span>
            <span>
              C <strong className="text-slate-100">{activeLegend.close.toFixed(2)}</strong>
            </span>
            {activeLegend.newsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-sky-400 font-sans">
                <Newspaper className="w-3 h-3" />
                Новостей за дату: {activeLegend.newsCount}
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          {store.selectedDateKey ? (
            <button
              type="button"
              onClick={() => store.setSelectedDateKey(null)}
              className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors"
            >
              <CalendarSearch className="w-3.5 h-3.5" />
              <span>Фильтр новостей: {store.selectedDateKey} (сбросить)</span>
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-terminal-panel/75 border border-terminal-border/60 text-[11px] text-slate-400">
              <Newspaper className="w-3 h-3 text-sky-400" />
              Точки над свечами = дни с новостями (клик по свече фильтрует ленту)
            </span>
          )}
        </div>
      </div>

      {/* Loading Spinner Overlay */}
      {store.isLoadingMarket && (
        <div className="absolute inset-0 z-20 bg-terminal-bg/60 backdrop-blur-[1px] flex items-center justify-center gap-2 text-xs text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Загрузка свечей Yahoo Finance...</span>
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={containerRef} className="w-full flex-1 min-h-[380px]" />
    </div>
  );
});
