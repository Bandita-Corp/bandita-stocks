# Fast Stocks

Персональный аналитический веб-терминал для мониторинга котировок, свечных графиков и новостного фона компаний по тикерам.

## Возможности MVP
- **Котировки и свечные графики (Yahoo Finance):** интервалы `15m`, `1h`, `1d`, `1wk` и периоды от `5Д` до `1Г`, гистограмма объемов, метрики дня и капитализации — бесплатно и без API-ключей.
- **Новостной поток (Google News RSS + авто-фоллбэк Bing / Yahoo RSS):** автоматический сбор новостей по тикеру и поисковым алиасам на русском (`RU`) и английском (`EN`) языках с кэшированием (TTL 10 минут), дедупликацией и накоплением архива в PostgreSQL. Если `news.google.com` недоступен без VPN, сервис автоматически переключается на открытые потоки `Bing News RSS` и `Yahoo Finance RSS`.
- **Корреляция «Свечи ↔ Новости»:** маркеры количества публикаций прямо над свечами на графике `TradingView Lightweight Charts v5`; клик по свече фильтрует ленту новостей за выбранную дату, а наведение на новость подсвечивает соответствующую свечу.
- **Гибридный список тикеров:** предустановленный стартовый набор активов (Prisma Seed) + бесплатный живой поиск по базе Yahoo Finance + ручное добавление новых инвестиционных идей с заметками и кастомным RSS-запросом.
- **Опциональная защита доступа (`APP_ACCESS_TOKEN`):** локально работает сразу без логина; для доступа извне достаточно задать `APP_ACCESS_TOKEN` в `.env` и открыть приложение по персональной ссылке `http://host:5180/?token=<SECRET>`.

## Технологический стек
- **Monorepo:** npm workspaces (`apps/backend`, `apps/frontend`), TypeScript `~5.9.3`
- **Backend:** Nest.js 11, Prisma 6, PostgreSQL 16 (`docker-compose.yml`), `yahoo-finance2`, `rss-parser`
- **Frontend:** React 18, Vite 6, MobX-State-Tree 7, TradingView Lightweight Charts 5, Tailwind CSS 3, Lucide Icons

## Быстрый запуск

```bash
# 1. Поднять PostgreSQL в Docker (порт 5440)
npm run db:up

# 2. Установить зависимости
npm install

# 3. Применить миграции Prisma и заполнить стартовые тикеры
npm run db:migrate
npm run db:seed

# 4. Запустить Backend (http://localhost:3040/api) и Frontend (http://localhost:5180)
npm run dev
```

Дополнительная документация:
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектурная спецификация
- [QUICKSTART.md](./QUICKSTART.md) — справочник по базовым модулям
