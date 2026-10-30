import {
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useStore } from '../models/StoreContext';

export const WatchlistSidebar: React.FC = observer(() => {
  const store = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualNewsQuery, setManualNewsQuery] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      store.clearSearch();
      return;
    }
    const timer = setTimeout(() => {
      store.searchTickersAction(trimmed);
    }, 320);
    return () => clearTimeout(timer);
  }, [searchQuery, store]);

  const handleQuickAddFromSearch = async (item: {
    symbol: string;
    name: string;
    exchange: string | null;
    assetType: string;
  }) => {
    setIsSubmitting(true);
    const ok = await store.addTickerToWatchlist({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange,
      assetType: item.assetType,
    });
    setIsSubmitting(false);
    if (ok) {
      setSearchQuery('');
      store.clearSearch();
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSymbol.trim()) return;
    setIsSubmitting(true);
    const ok = await store.addTickerToWatchlist({
      symbol: manualSymbol.trim().toUpperCase(),
      newsQuery: manualNewsQuery.trim() || undefined,
      notes: manualNotes.trim() || undefined,
    });
    setIsSubmitting(false);
    if (ok) {
      setManualSymbol('');
      setManualNewsQuery('');
      setManualNotes('');
      setIsAddingManual(false);
    }
  };

  const existingSymbols = new Set(store.tickers.map((t) => t.symbol));

  return (
    <aside className="w-full lg:w-80 xl:w-84 shrink-0 bg-terminal-panel border-b lg:border-b-0 lg:border-r border-terminal-border flex flex-col h-full">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-terminal-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm">
            FS
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              Fast Stocks
            </h1>
            <p className="text-[11px] text-terminal-muted">
              Котировки &amp; новостной пульс
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAddingManual((v) => !v)}
          title="Добавить свою идею / тикер вручную"
          className={`p-1.5 rounded-md border text-xs flex items-center gap-1 transition-colors ${
            isAddingManual
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-terminal-card border-terminal-border text-slate-300 hover:border-slate-600'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Идея</span>
        </button>
      </div>

      {/* Manual Idea Form */}
      {isAddingManual && (
        <form
          onSubmit={handleManualSubmit}
          className="p-3 bg-terminal-card/90 border-b border-terminal-border space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Новая инвестиционная идея
            </span>
            <button
              type="button"
              onClick={() => setIsAddingManual(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={manualSymbol}
            onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
            placeholder="Тикер Yahoo (напр. PLTR, AMD, ETH-USD)"
            required
            className="w-full px-2.5 py-1.5 text-xs rounded bg-terminal-bg border border-terminal-border text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={manualNewsQuery}
            onChange={(e) => setManualNewsQuery(e.target.value)}
            placeholder="Ключевые слова для RSS (опционально)"
            className="w-full px-2.5 py-1.5 text-xs rounded bg-terminal-bg border border-terminal-border text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Заметка / гипотеза по активу..."
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs rounded bg-terminal-bg border border-terminal-border text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            type="submit"
            disabled={isSubmitting || !manualSymbol.trim()}
            className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Проверить и добавить в список
          </button>
        </form>
      )}

      {/* Live Yahoo Finance Ticker Search */}
      <div className="p-3 border-b border-terminal-border relative">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск компании или тикера (Yahoo)..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-terminal-bg border border-terminal-border text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {(searchQuery || store.isSearching) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                store.clearSearch();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {store.isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {searchQuery.trim().length > 0 && store.searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-12 z-30 bg-terminal-card border border-slate-700 rounded-lg shadow-2xl max-h-72 overflow-y-auto divide-y divide-terminal-border">
            {store.searchResults.map((item) => {
              const alreadyAdded = existingSymbols.has(item.symbol);
              return (
                <button
                  key={`${item.symbol}-${item.exchange}`}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (alreadyAdded) {
                      store.selectTicker(item.symbol);
                      setSearchQuery('');
                      store.clearSearch();
                    } else {
                      handleQuickAddFromSearch(item);
                    }
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-100">
                        {item.symbol}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {item.assetType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.name}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] shrink-0 px-2 py-0.5 rounded ${
                      alreadyAdded
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-blue-400 bg-blue-500/10'
                    }`}
                  >
                    {alreadyAdded ? 'Открыть' : '+ Добавить'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Watchlist Header */}
      <div className="px-4 py-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-terminal-muted border-b border-terminal-border/60">
        <span>Отслеживаемые ({store.tickers.length})</span>
        <span>Цена / 24ч</span>
      </div>

      {/* Watchlist Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-terminal-border/50">
        {store.isLoadingWatchlist && store.tickers.length === 0 ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Загрузка тикеров...</span>
          </div>
        ) : (
          store.tickers.map((ticker) => {
            const isActive = ticker.symbol === store.activeSymbol;
            const positive = ticker.isPositive;

            return (
              <div
                key={ticker.symbol}
                onClick={() => store.selectTicker(ticker.symbol)}
                className={`group px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 border-l-2 border-l-blue-500'
                    : 'hover:bg-terminal-card/60 border-l-2 border-l-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-100">
                      {ticker.symbol}
                    </span>
                    {ticker.exchange && (
                      <span className="text-[10px] text-slate-500 truncate">
                        {ticker.exchange}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {ticker.name}
                  </p>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <div className="text-xs font-mono font-medium text-slate-100">
                      {ticker.formattedPrice}
                    </div>
                    <div
                      className={`text-[11px] font-mono inline-flex items-center gap-0.5 ${
                        ticker.changePercent == null
                          ? 'text-slate-500'
                          : positive
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {ticker.changePercent != null &&
                        (positive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        ))}
                      {ticker.formattedChangePercent}
                    </div>
                  </div>

                  <button
                    type="button"
                    title={`Удалить ${ticker.symbol}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      store.removeTickerFromWatchlist(ticker.symbol);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
});
