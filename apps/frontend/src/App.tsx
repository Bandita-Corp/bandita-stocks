import { AlertCircle, KeyRound, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { ingestTokenFromUrl } from './api/client';
import { CandlestickChart } from './components/CandlestickChart';
import { NewsFeedPanel } from './components/NewsFeedPanel';
import { TickerHeader } from './components/TickerHeader';
import { WatchlistSidebar } from './components/WatchlistSidebar';
import { useStore } from './models/StoreContext';

export const App: React.FC = observer(() => {
  const store = useStore();
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    ingestTokenFromUrl();
    store.initialize();
  }, [store]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    store.submitAccessToken(tokenInput.trim());
  };

  if (store.authRequiredError) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center p-4">
        <form
          onSubmit={handleTokenSubmit}
          className="w-full max-w-sm bg-terminal-panel border border-terminal-border rounded-xl p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-2.5 text-blue-400">
            <KeyRound className="w-5 h-5" />
            <h1 className="text-base font-semibold text-slate-100">
              Доступ к Fast Stocks
            </h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Для этого инстанса включен персональный токен администратора (
            <code>APP_ACCESS_TOKEN</code>). Введите токен или откройте приложение по персональной ссылке <code>?token=...</code>.
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Введите персональный токен..."
            autoFocus
            className="w-full px-3 py-2 text-xs rounded-md bg-terminal-bg border border-terminal-border text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
          >
            Войти в терминал
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-terminal-bg text-slate-100 flex flex-col">
      {/* Global Error Toast Banner */}
      {store.errorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800/70 px-4 py-2 text-xs text-rose-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{store.errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => store.dismissError()}
            className="text-rose-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 3-Pane Analytical Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <WatchlistSidebar />

        <main className="flex-1 min-w-0 min-h-0 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden">
          <div className="flex-1 min-w-0 min-h-[480px] flex flex-col">
            <TickerHeader />
            <CandlestickChart />
          </div>

          <NewsFeedPanel />
        </main>
      </div>
    </div>
  );
});
