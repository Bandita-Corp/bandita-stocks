import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRESET_TICKERS = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: 'Apple OR AAPL',
    notes: 'Флагман потребительской электроники и экосистемы сервисов. Отслеживать отчеты по iPhone, Services и AI-релизам.',
    sortOrder: 1,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: 'NVIDIA OR NVDA',
    notes: 'Ключевой бенефициар AI-инфраструктуры и дата-центров. Высокая чувствительность к новостям о капексе бигтеха и экспортных ограничениях.',
    sortOrder: 2,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: 'Microsoft OR MSFT',
    notes: 'Облачный сегмент Azure и корпоративный AI (Copilot).',
    sortOrder: 3,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: 'Google OR Alphabet OR GOOGL',
    notes: 'Поисковая реклама, YouTube, Google Cloud и модели Gemini.',
    sortOrder: 4,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: 'Tesla OR TSLA',
    notes: 'Высоковолатильный актив, сильно реагирующий на новости о поставках EV, FSD, Robotaxi и заявления Илона Маска.',
    sortOrder: 5,
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: 'Amazon OR AMZN',
    notes: 'E-commerce + маржинальность облачного бизнеса AWS.',
    sortOrder: 6,
  },
  {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    newsQuery: '"Meta Platforms" OR META stock',
    notes: 'Рекламная выручка экосистемы приложений и инвестиции в открытые AI-модели.',
    sortOrder: 7,
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    exchange: 'NYSEArca',
    assetType: 'ETF',
    newsQuery: '"S&P 500" OR ФРС США OR Wall Street',
    notes: 'Бенчмарк широкого рынка США. Реагирует на макростатистику (CPI, NFP) и ставки ФРС.',
    sortOrder: 8,
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin USD',
    exchange: 'CCC',
    assetType: 'CRYPTOCURRENCY',
    newsQuery: 'Bitcoin OR BTC',
    notes: 'Индикатор аппетита к риску на крипторынке и потоков в спотовые ETF.',
    sortOrder: 9,
  },
  {
    symbol: 'GC=F',
    name: 'Gold Futures',
    exchange: 'COMEX',
    assetType: 'FUTURE',
    newsQuery: 'Gold price OR цена золота',
    notes: 'Защитный актив при геополитической напряженности и снижении реальных ставок.',
    sortOrder: 10,
  },
];

async function main() {
  console.log('Seeding preset watchlist tickers...');

  for (const item of PRESET_TICKERS) {
    await prisma.ticker.upsert({
      where: { symbol: item.symbol },
      create: item,
      update: {
        name: item.name,
        exchange: item.exchange,
        assetType: item.assetType,
      },
    });
  }

  console.log(`Seeded ${PRESET_TICKERS.length} preset tickers.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
