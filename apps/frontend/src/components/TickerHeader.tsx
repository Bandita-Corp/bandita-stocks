import {
  Check,
  FileText,
  RefreshCw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { TimeframeInterval, TimeframeRange } from '../models/RootStore';
import { useStore } from '../models/StoreContext';

const INTERVALS: { value: TimeframeInterval; label: string }[] = [
  { value: '15m', label: '15м' },
  { value: '1h', label: '1ч' },
  { value: '1d', label: '1Д' },
  { value: '1wk', label: '1Н' },
];

const RANGES: { value: TimeframeRange; label: string }[] = [
  { value: '5d', label: '5Д' },
  { value: '1mo', label: '1М' },
  { value: '3mo', label: '3М' },
  { value: '6mo', label: '6М' },
  { value: '1y', label: '1Г' },
];

function formatCompactNumber(val: number | null | undefined): string {
  if (val == null) return '—';
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(val);
}

export const TickerHeader: React.FC = observer(() => {
  const store = useStore();
  const ticker = store.activeTicker;
  const quote = store.activeQuote;

  const [showSettings, setShowSettings] = useState(false);
  const [newsQueryDraft, setNewsQueryDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setNewsQueryDraft(ticker?.newsQuery || '');
    setNotesDraft(ticker?.notes || '');
  }, [ticker?.symbol, ticker?.newsQuery, ticker?.notes]);

  const price = quote?.price ?? ticker?.lastPrice ?? null;
  const change = quote?.change ?? ticker?.change ?? null;
  const changePct = quote?.changePercent ?? ticker?.changePercent ?? null;
  const currency = quote?.currency || ticker?.currency || 'USD';
  const isUp = (changePct ?? 0) >= 0;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker) return;
    const ok = await store.saveTickerSettings(ticker.symbol, {
      newsQuery: newsQueryDraft,
      notes: notesDraft,
    });
    if (ok) {
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    }
  };

  return (
    <div className="bg-terminal-panel border-b border-terminal-border px-4 py-3 space-y-3">
      {/* Top Row: Symbol, Live Quote & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                {store.activeSymbol || '—'}
              </h2>
              {(quote?.exchange || ticker?.exchange) && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-terminal-card border border-terminal-border text-slate-400">
                  {quote?.exchange || ticker?.exchange}
                </span>
              )}
              {quote?.marketState && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    quote.marketState === 'REGULAR'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {quote.marketState}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {quote?.name || ticker?.name || ''}
            </p>
          </div>

          {price != null && (
            <div className="flex items-baseline gap-2.5 pl-1">
              <span className="text-2xl font-mono font-semibold text-slate-50">
                {price.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: price < 1 ? 4 : 2,
                })}{' '}
                <span className="text-xs font-normal text-slate-400">
                  {currency}
                </span>
              </span>

              {changePct != null && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ${
                    isUp
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {isUp ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {change != null
                    ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} `
                    : ''}
                  ({isUp ? '+' : ''}
                  {changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Key Market Metrics + Refresh & Hypothesis Button */}
        <div className="flex flex-wrap items-center gap-2">
          {quote && (
            <div className="hidden xl:flex items-center gap-4 mr-2 text-xs text-slate-400 border-r border-terminal-border pr-4">
              <div>
                <span className="text-slate-500">Дневн. диап.: </span>
                <span className="font-mono text-slate-200">
                  {quote.dayLow?.toFixed(2) ?? '—'} –{' '}
                  {quote.dayHigh?.toFixed(2) ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Объем: </span>
                <span className="font-mono text-slate-200">
                  {formatCompactNumber(quote.volume)}
                </span>
              </div>
              {quote.marketCap != null && (
                <div>
                  <span className="text-slate-500">Капитализация: </span>
                  <span className="font-mono text-slate-200">
                    {formatCompactNumber(quote.marketCap)}
                  </span>
                </div>
              )}
            </div>
          )}

          {ticker && (
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1.5 transition-colors ${
                showSettings || ticker.notes
                  ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                  : 'bg-terminal-card border-terminal-border text-slate-300 hover:border-slate-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Заметка &amp; RSS-запрос</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => store.refreshAll()}
            disabled={store.isLoadingMarket || store.isLoadingNews}
            title="Обновить котировки, свечи и новости"
            className="px-2.5 py-1.5 rounded-md bg-terminal-card border border-terminal-border hover:border-slate-600 text-xs text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                store.isLoadingMarket || store.isLoadingNews
                  ? 'animate-spin text-blue-400'
                  : ''
              }`}
            />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* Second Row: Timeframe Switchers & Period Performance */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          {/* Candle Interval */}
          <div className="flex items-center gap-1 bg-terminal-bg p-0.5 rounded-md border border-terminal-border">
            <span className="text-[11px] text-slate-500 px-2">Свеча:</span>
            {INTERVALS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => store.setInterval(item.value)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  store.interval === item.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Period Range */}
          <div className="flex items-center gap-1 bg-terminal-bg p-0.5 rounded-md border border-terminal-border">
            <span className="text-[11px] text-slate-500 px-2">Период:</span>
            {RANGES.map((item) => {
              const disabled =
                store.interval === '15m' &&
                ['3mo', '6mo', '1y'].includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => store.setRange(item.value)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                    store.range === item.value
                      ? 'bg-slate-700 text-white'
                      : disabled
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Period Return Summary */}
        {store.periodStats && (
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span>
              За выбранный период:{' '}
              <strong
                className={`font-mono ${
                  store.periodStats.pct >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {store.periodStats.pct >= 0 ? '+' : ''}
                {store.periodStats.pct.toFixed(2)}%
              </strong>
            </span>
            <span className="hidden sm:inline text-slate-500">
              Min/Max:{' '}
              <span className="font-mono text-slate-300">
                {store.periodStats.low.toFixed(2)} –{' '}
                {store.periodStats.high.toFixed(2)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Collapsible Analyst Notes & Custom RSS Search Query Panel */}
      {showSettings && ticker && (
        <form
          onSubmit={handleSaveSettings}
          className="mt-2 p-3 rounded-lg bg-terminal-bg border border-terminal-border grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-blue-400" />
              Поисковый запрос Google News RSS для {ticker.symbol}
            </label>
            <input
              type="text"
              value={newsQueryDraft}
              onChange={(e) => setNewsQueryDraft(e.target.value)}
              placeholder={`Напр.: "${ticker.name}" OR ${ticker.symbol}`}
              className="w-full px-2.5 py-1.5 text-xs rounded bg-terminal-panel border border-terminal-border text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Поддерживаются операторы <code>OR</code>, точные фразы в кавычках и русские/английские алиасы.
            </p>
          </div>

          <div className="flex flex-col">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Аналитическая заметка / рабочая гипотеза
            </label>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={2}
              placeholder="Запишите наблюдения о реакции цены на отчеты и новости..."
              className="w-full px-2.5 py-1.5 text-xs rounded bg-terminal-panel border border-terminal-border text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              {savedToast && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Сохранено
                </span>
              )}
              <button
                type="submit"
                disabled={store.isSavingSettings}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
              >
                Сохранить и обновить RSS
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
});
