import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  FilterX,
  Globe,
  Loader2,
  Newspaper,
  RefreshCw,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { useStore } from '../models/StoreContext';

function formatRelativeOrDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin >= 0 && diffMin < 60) {
    return `${Math.max(1, diffMin)} мин назад`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours >= 0 && diffHours < 24) {
    return `${diffHours} ч назад`;
  }
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const NewsFeedPanel: React.FC = observer(() => {
  const store = useStore();
  const articles = store.filteredNews;

  return (
    <section className="w-full xl:w-[410px] 2xl:w-[450px] shrink-0 bg-terminal-panel border-t xl:border-t-0 xl:border-l border-terminal-border flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-terminal-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-sky-400 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-100 truncate">
              Новости: {store.activeSymbol}
            </h3>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-terminal-card border border-terminal-border text-slate-400">
              {articles.length}
            </span>
          </div>
          {store.newsQueryUsed && (
            <p
              className="text-[11px] text-slate-500 truncate mt-0.5"
              title={`Google News RSS запрос: ${store.newsQueryUsed}`}
            >
              RSS: <span className="text-slate-400">{store.newsQueryUsed}</span>
            </p>
          )}
        </div>

        {/* Language Toggle (RU / EN) & Refresh */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-terminal-bg rounded-md p-0.5 border border-terminal-border">
            <Globe className="w-3 h-3 text-slate-500 ml-1.5 mr-1" />
            <button
              type="button"
              onClick={() => store.setNewsLang('ru')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                store.newsLang === 'ru'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => store.setNewsLang('en')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                store.newsLang === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={() => store.loadNews(true)}
            disabled={store.isLoadingNews}
            title="Принудительно опросить Google News RSS"
            className="p-1.5 rounded-md bg-terminal-card border border-terminal-border text-slate-300 hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                store.isLoadingNews ? 'animate-spin text-blue-400' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Active Date Filter Banner */}
      {store.selectedDateKey && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-2 text-xs">
          <div className="text-amber-200 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {store.isExactDateMatch
                ? `События за ${store.selectedDateKey}`
                : `Ближайшие события (±1 день к ${store.selectedDateKey})`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => store.setSelectedDateKey(null)}
            className="text-amber-300 hover:text-amber-100 inline-flex items-center gap-1 text-[11px] shrink-0"
          >
            <FilterX className="w-3.5 h-3.5" />
            Все даты
          </button>
        </div>
      )}

      {/* Warning Banner */}
      {store.newsWarning && (
        <div className="px-4 py-2 bg-amber-950/50 border-b border-amber-800/50 text-[11px] text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{store.newsWarning}</span>
        </div>
      )}

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto divide-y divide-terminal-border/60">
        {store.isLoadingNews && store.news.length === 0 ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Загрузка RSS-потока Google News...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-slate-400">
              {store.selectedDateKey
                ? `В архиве нет новостей около даты ${store.selectedDateKey}.`
                : 'По текущему запросу новости не найдены.'}
            </p>
            {store.selectedDateKey ? (
              <button
                type="button"
                onClick={() => store.setSelectedDateKey(null)}
                className="text-xs text-blue-400 hover:underline"
              >
                Показать всю ленту новостей
              </button>
            ) : (
              <p className="text-[11px] text-slate-500">
                Попробуйте переключить язык <strong>RU / EN</strong> или уточнить RSS-запрос в настройках тикера.
              </p>
            )}
          </div>
        ) : (
          articles.map((item) => (
            <article
              key={item.id}
              onMouseEnter={() => store.setHoveredDateKey(item.dateKey)}
              onMouseLeave={() => store.setHoveredDateKey(null)}
              className="p-3.5 hover:bg-terminal-card/70 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 truncate max-w-[60%]">
                  {item.sourceName}
                </span>
                <time className="text-[11px] text-slate-500 shrink-0">
                  {formatRelativeOrDate(item.publishedAt)}
                </time>
              </div>

              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-slate-100 group-hover:text-blue-300 leading-snug flex items-start justify-between gap-1.5"
              >
                <span>{item.title}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500 group-hover:text-blue-400" />
              </a>

              {item.snippet && (
                <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {item.snippet}
                </p>
              )}
            </article>
          ))
        )}
      </div>

      {/* Footer Cache Info */}
      <div className="px-4 py-2 border-t border-terminal-border text-[11px] text-slate-500 flex items-center justify-between gap-2">
        <span className="truncate">
          Источник: {store.newsProviderUsed || 'Google News RSS'} (
          {store.newsLang.toUpperCase()})
        </span>
        <span className="shrink-0">
          {store.newsFromCache ? 'Кэш БД (TTL 10м)' : 'Свежий опрос RSS'}
        </span>
      </div>
    </section>
  );
});
