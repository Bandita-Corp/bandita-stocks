import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';
import { PrismaService } from '../../prisma/prisma.service';

export type NewsLanguage = 'ru' | 'en';

export interface NewsItemDto {
  id: string;
  tickerSymbol: string;
  title: string;
  url: string;
  sourceName: string;
  sourceUrl: string | null;
  snippet: string | null;
  lang: NewsLanguage;
  publishedAt: string;
}

type CustomItem = {
  rawSource?:
    | string
    | {
        _?: string;
        $?: { url?: string };
      };
  bingSource?: string;
};

interface NormalizedFeedArticle {
  guid: string;
  title: string;
  url: string;
  sourceName: string;
  sourceUrl: string | null;
  snippet: string | null;
  publishedAt: Date;
}

const NEWS_TTL_MS = 10 * 60_000; // 10 minutes cache TTL
const GOOGLE_COOLDOWN_MS = 10 * 60_000; // Skip blocked Google RSS for 10 min after timeout

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly parser: Parser<Record<string, unknown>, CustomItem>;
  private googleBlockedUntil = 0;

  constructor(private readonly prisma: PrismaService) {
    this.parser = new Parser({
      customFields: {
        item: [
          ['source', 'rawSource'],
          ['News:Source', 'bingSource'],
        ],
      },
    });
  }

  async getNewsForTicker(
    symbolInput: string,
    langInput?: string,
    forceRefresh = false,
  ) {
    const symbol = (symbolInput || '').trim().toUpperCase();
    const lang: NewsLanguage = langInput === 'en' ? 'en' : 'ru';

    const ticker = await this.prisma.ticker.findUnique({
      where: { symbol },
    });

    const effectiveQuery = this.resolveQuery(
      symbol,
      ticker?.name,
      ticker?.newsQuery,
      lang,
    );

    if (ticker) {
      const fetchState = await this.prisma.newsFetchState.findUnique({
        where: {
          tickerSymbol_lang: {
            tickerSymbol: symbol,
            lang,
          },
        },
      });

      const cachedArticles = await this.prisma.newsArticle.findMany({
        where: { tickerSymbol: symbol, lang },
        orderBy: { publishedAt: 'desc' },
        take: 80,
      });

      const isFresh =
        !forceRefresh &&
        fetchState != null &&
        cachedArticles.length > 0 &&
        fetchState.queryUsed === effectiveQuery &&
        Date.now() - fetchState.lastFetchedAt.getTime() < NEWS_TTL_MS;

      if (isFresh) {
        return {
          symbol,
          lang,
          queryUsed: effectiveQuery,
          providerUsed: 'PostgreSQL Cache',
          lastFetchedAt: fetchState.lastFetchedAt.toISOString(),
          fromCache: true,
          items: cachedArticles.map((a) => this.mapDbArticle(a)),
        };
      }
    }

    try {
      const { articles, providerUsed } = await this.fetchLiveRssWithFallback(
        symbol,
        effectiveQuery,
        lang,
      );

      if (ticker) {
        for (const item of articles) {
          await this.prisma.newsArticle.upsert({
            where: {
              tickerSymbol_guid: {
                tickerSymbol: symbol,
                guid: item.guid,
              },
            },
            create: {
              tickerSymbol: symbol,
              guid: item.guid,
              title: item.title,
              url: item.url,
              sourceName: item.sourceName,
              sourceUrl: item.sourceUrl,
              snippet: item.snippet,
              lang,
              publishedAt: item.publishedAt,
            },
            update: {
              title: item.title,
              url: item.url,
              sourceName: item.sourceName,
              sourceUrl: item.sourceUrl,
              snippet: item.snippet,
              fetchedAt: new Date(),
            },
          });
        }

        const now = new Date();
        await this.prisma.newsFetchState.upsert({
          where: {
            tickerSymbol_lang: {
              tickerSymbol: symbol,
              lang,
            },
          },
          create: {
            tickerSymbol: symbol,
            lang,
            queryUsed: effectiveQuery,
            lastFetchedAt: now,
          },
          update: {
            queryUsed: effectiveQuery,
            lastFetchedAt: now,
          },
        });

        const storedArticles = await this.prisma.newsArticle.findMany({
          where: { tickerSymbol: symbol, lang },
          orderBy: { publishedAt: 'desc' },
          take: 80,
        });

        return {
          symbol,
          lang,
          queryUsed: effectiveQuery,
          providerUsed,
          lastFetchedAt: now.toISOString(),
          fromCache: false,
          items: storedArticles.map((a) => this.mapDbArticle(a)),
        };
      }

      return {
        symbol,
        lang,
        queryUsed: effectiveQuery,
        providerUsed,
        lastFetchedAt: new Date().toISOString(),
        fromCache: false,
        items: articles.map((item) => ({
          id: item.guid,
          tickerSymbol: symbol,
          title: item.title,
          url: item.url,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          snippet: item.snippet,
          lang,
          publishedAt: item.publishedAt.toISOString(),
        })),
      };
    } catch (error: any) {
      this.logger.warn(
        `All RSS providers failed for ${symbol} (${lang}): ${error?.message}`,
      );

      if (ticker) {
        const fallback = await this.prisma.newsArticle.findMany({
          where: { tickerSymbol: symbol, lang },
          orderBy: { publishedAt: 'desc' },
          take: 80,
        });
        return {
          symbol,
          lang,
          queryUsed: effectiveQuery,
          providerUsed: 'PostgreSQL Archive',
          lastFetchedAt: null,
          fromCache: true,
          warning: `Не удалось опросить RSS (${error?.message || 'ошибка сети'}), показан сохраненный архив`,
          items: fallback.map((a) => this.mapDbArticle(a)),
        };
      }

      return {
        symbol,
        lang,
        queryUsed: effectiveQuery,
        providerUsed: 'None',
        lastFetchedAt: null,
        fromCache: false,
        warning: `Не удалось загрузить RSS-ленту: ${error?.message || 'ошибка сети'}`,
        items: [],
      };
    }
  }

  /**
   * Primary: Google News RSS.
   * Automatic fallback (e.g. when news.google.com is ISP-blocked without VPN):
   * Bing News RSS (RU/EN) + Yahoo Finance Headline RSS (EN).
   */
  private async fetchLiveRssWithFallback(
    symbol: string,
    query: string,
    lang: NewsLanguage,
  ): Promise<{ articles: NormalizedFeedArticle[]; providerUsed: string }> {
    const now = Date.now();

    if (now >= this.googleBlockedUntil) {
      const googleUrl = this.buildGoogleNewsUrl(query, lang);
      try {
        const xml = await this.fetchXml(googleUrl, 3200);
        const feed = await this.parser.parseString(xml);
        const articles = this.normalizeFeedItems(lang, feed.items || []);
        if (articles.length > 0) {
          return { articles, providerUsed: 'Google News RSS' };
        }
      } catch (err: any) {
        this.googleBlockedUntil = Date.now() + GOOGLE_COOLDOWN_MS;
        this.logger.warn(
          `Google News RSS unreachable (${err?.message}). Switching to Bing/Yahoo RSS fallback for 10m.`,
        );
      }
    }

    // Fallback RSS feeds that work without VPN and require zero API keys
    const bingQuery = this.simplifyQueryForBing(symbol, query, lang);
    const bingUrl = this.buildBingNewsUrl(bingQuery, lang);

    const tasks: Array<Promise<{ name: string; items: Array<Parser.Item & CustomItem> }>> = [
      this.fetchXml(bingUrl, 6000)
        .then((xml) => this.parser.parseString(xml))
        .then((feed) => ({ name: 'Bing News RSS', items: feed.items || [] })),
    ];

    if (lang === 'en') {
      const yahooUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
        symbol,
      )}&region=US&lang=en-US`;
      tasks.unshift(
        this.fetchXml(yahooUrl, 6000)
          .then((xml) => this.parser.parseString(xml))
          .then((feed) => ({
            name: 'Yahoo Finance RSS',
            items: feed.items || [],
          })),
      );
    }

    const settled = await Promise.allSettled(tasks);
    const combinedRaw: Array<Parser.Item & CustomItem> = [];
    const activeProviders: string[] = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value.items.length > 0) {
        activeProviders.push(res.value.name);
        combinedRaw.push(...res.value.items);
      }
    }

    if (combinedRaw.length === 0) {
      const firstErr = settled.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      throw new Error(
        firstErr?.reason?.message || 'RSS-источники не вернули публикаций',
      );
    }

    const articles = this.normalizeFeedItems(lang, combinedRaw);
    articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    return {
      articles,
      providerUsed: activeProviders.join(' + '),
    };
  }

  private async fetchXml(url: string, timeoutMs: number): Promise<string> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  }

  private resolveQuery(
    symbol: string,
    companyName?: string | null,
    customQuery?: string | null,
    lang: NewsLanguage = 'ru',
  ): string {
    if (customQuery && customQuery.trim()) {
      return customQuery.trim();
    }
    if (companyName && companyName.trim()) {
      const cleaned = companyName
        .replace(
          /\b(Inc\.?|Corp\.?|Corporation|Company|Co\.?|Ltd\.?|PLC|Holdings?|Group)\b/gi,
          '',
        )
        .replace(/[.,]+$/g, '')
        .trim();
      if (cleaned && cleaned.toUpperCase() !== symbol) {
        return `"${cleaned}" OR ${symbol}`;
      }
    }
    return lang === 'ru' ? `${symbol} акции` : `${symbol} stock`;
  }

  private simplifyQueryForBing(
    symbol: string,
    query: string,
    lang: NewsLanguage,
  ): string {
    // Bing News RSS handles plain keywords better than boolean OR expressions
    const firstPart = query.split(/\s+OR\s+/i)[0]?.replace(/"/g, '').trim();
    const base = firstPart || symbol;
    if (lang === 'ru') {
      return /акци|котиров|рынок|цен|курс|фРС/i.test(base)
        ? base
        : `${base} акции`;
    }
    return /stock|share|price|market/i.test(base) ? base : `${base} stock`;
  }

  private buildGoogleNewsUrl(query: string, lang: NewsLanguage): string {
    const encoded = encodeURIComponent(query);
    if (lang === 'en') {
      return `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
    }
    return `https://news.google.com/rss/search?q=${encoded}&hl=ru&gl=RU&ceid=RU:ru`;
  }

  private buildBingNewsUrl(query: string, lang: NewsLanguage): string {
    const encoded = encodeURIComponent(query);
    if (lang === 'en') {
      return `https://www.bing.com/news/search?q=${encoded}&format=rss&setlang=en-US&cc=US`;
    }
    return `https://www.bing.com/news/search?q=${encoded}&format=rss&setlang=ru-RU&cc=RU`;
  }

  private unwrapArticleUrl(rawLink: string): string {
    try {
      const parsed = new URL(rawLink);
      if (
        parsed.hostname.includes('bing.com') &&
        parsed.pathname.includes('apiclick.aspx')
      ) {
        const real = parsed.searchParams.get('url');
        if (real) return real;
      }
    } catch {
      // Keep original URL if parsing fails
    }
    return rawLink;
  }

  private extractHostnameSource(articleUrl: string): string | null {
    try {
      const host = new URL(articleUrl).hostname.replace(/^www\./i, '');
      return host || null;
    } catch {
      return null;
    }
  }

  private normalizeFeedItems(
    lang: NewsLanguage,
    rawItems: Array<Parser.Item & CustomItem>,
  ): NormalizedFeedArticle[] {
    const seen = new Set<string>();
    const results: NormalizedFeedArticle[] = [];

    for (const item of rawItems.slice(0, 60)) {
      const rawLink = (item.link || '').trim();
      const rawTitle = (item.title || '').trim();
      if (!rawLink || !rawTitle) continue;

      const url = this.unwrapArticleUrl(rawLink);

      let sourceName = '';
      let sourceUrl: string | null = null;

      if (typeof item.bingSource === 'string' && item.bingSource.trim()) {
        sourceName = item.bingSource.trim();
      } else if (typeof item.rawSource === 'string' && item.rawSource.trim()) {
        sourceName = item.rawSource.trim();
      } else if (item.rawSource && typeof item.rawSource === 'object') {
        if (item.rawSource._ && item.rawSource._.trim()) {
          sourceName = item.rawSource._.trim();
        }
        if (item.rawSource.$?.url) {
          sourceUrl = item.rawSource.$.url;
        }
      }

      let title = rawTitle;
      if (sourceName && title.endsWith(` - ${sourceName}`)) {
        title = title.slice(0, -` - ${sourceName}`.length).trim();
      } else if (!sourceName) {
        const dashIdx = title.lastIndexOf(' - ');
        if (dashIdx > 20 && title.length - dashIdx < 45) {
          sourceName = title.slice(dashIdx + 3).trim();
          title = title.slice(0, dashIdx).trim();
        }
      }

      if (!sourceName) {
        sourceName = this.extractHostnameSource(url) || 'RSS News';
      }

      const dedupeKey = `${lang}:${url}`.slice(0, 240);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const pubDate = item.isoDate || item.pubDate;
      const parsedDate = pubDate ? new Date(pubDate) : new Date();
      const publishedAt = Number.isNaN(parsedDate.getTime())
        ? new Date()
        : parsedDate;

      const rawSnippet = (item.contentSnippet || item.content || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const snippet =
        rawSnippet && rawSnippet !== rawTitle && rawSnippet !== title
          ? rawSnippet.slice(0, 320)
          : null;

      results.push({
        guid: dedupeKey,
        title,
        url,
        sourceName,
        sourceUrl,
        snippet,
        publishedAt,
      });
    }

    return results;
  }

  private mapDbArticle(a: {
    id: string;
    tickerSymbol: string;
    title: string;
    url: string;
    sourceName: string;
    sourceUrl: string | null;
    snippet: string | null;
    lang: string;
    publishedAt: Date;
  }): NewsItemDto {
    return {
      id: a.id,
      tickerSymbol: a.tickerSymbol,
      title: a.title,
      url: a.url,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      snippet: a.snippet,
      lang: a.lang === 'en' ? 'en' : 'ru',
      publishedAt: a.publishedAt.toISOString(),
    };
  }
}
