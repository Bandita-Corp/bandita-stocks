-- CreateTable
CREATE TABLE "Ticker" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'EQUITY',
    "newsQuery" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastPrice" DOUBLE PRECISION,
    "previousClose" DOUBLE PRECISION,
    "change" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "marketState" TEXT,
    "quoteUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "tickerSymbol" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "snippet" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'ru',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsFetchState" (
    "tickerSymbol" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "queryUsed" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsFetchState_pkey" PRIMARY KEY ("tickerSymbol","lang")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticker_symbol_key" ON "Ticker"("symbol");

-- CreateIndex
CREATE INDEX "NewsArticle_tickerSymbol_lang_publishedAt_idx" ON "NewsArticle"("tickerSymbol", "lang", "publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_tickerSymbol_guid_key" ON "NewsArticle"("tickerSymbol", "guid");

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_tickerSymbol_fkey" FOREIGN KEY ("tickerSymbol") REFERENCES "Ticker"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsFetchState" ADD CONSTRAINT "NewsFetchState_tickerSymbol_fkey" FOREIGN KEY ("tickerSymbol") REFERENCES "Ticker"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
