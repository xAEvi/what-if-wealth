import YahooFinance from "yahoo-finance2";
import type { PriceBar, PriceHistory } from "@/lib/portfolio/types";
import { TtlCache } from "./cache";
export { hasCoverage } from "./coverage";

// Unico punto de contacto con la libreria. Nada mas importa yahoo-finance2.
const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const HISTORY_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas, Yahoo responde 429 con facilidad
const historyCache = new TtlCache<PriceHistory>(HISTORY_TTL_MS);

export type SearchCandidate = {
  symbol: string;
  name?: string;
  quoteType?: string;
};

// La barra trae el cierre en UTC; el gmtoffset del meta lo devuelve a la fecha
// local del exchange para no desfasar el dia respecto del Trade Date del CSV.
function toLocalIsoDate(date: Date, gmtoffset: number): string {
  return new Date(date.getTime() + gmtoffset * 1000).toISOString().slice(0, 10);
}

/** Historia diaria de un ticker desde `from`, cacheada por ticker+from. */
export async function getHistory(
  ticker: string,
  from: string
): Promise<PriceHistory> {
  const key = `${ticker}|${from}`;
  const cached = historyCache.get(key);
  if (cached) {
    console.log(`[history] cache hit ${key}`);
    return cached;
  }
  console.log(`[history] cache miss ${key}`);

  const result = await yahoo.chart(ticker, {
    period1: from,
    interval: "1d",
    return: "array",
  });

  const firstTradeDate = result.meta.firstTradeDate
    ? toLocalIsoDate(result.meta.firstTradeDate, result.meta.gmtoffset)
    : "";

  const bars: PriceBar[] = result.quotes
    .filter((quote) => quote.close != null && quote.adjclose != null)
    .map((quote) => ({
      date: toLocalIsoDate(quote.date, result.meta.gmtoffset),
      close: quote.close as number,
      adjClose: quote.adjclose as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const history: PriceHistory = { ticker, firstTradeDate, bars };
  historyCache.set(key, history);
  return history;
}

/** Precio actual de varios tickers en una sola llamada en lote. */
export async function getQuotes(
  tickers: string[]
): Promise<Record<string, number>> {
  const quotes = await yahoo.quote(tickers, { return: "object" });
  const result: Record<string, number> = {};

  for (const [symbol, quote] of Object.entries(quotes)) {
    if (quote.regularMarketPrice != null)
      result[symbol] = quote.regularMarketPrice;
  }
  return result;
}

/** Candidatos para el autocompletado de sustitucion de ticker. */
export async function searchTickers(query: string): Promise<SearchCandidate[]> {
  const result = await yahoo.search(query, { quotesCount: 8, newsCount: 0 });

  return result.quotes
    .filter((quote) => "symbol" in quote && quote.isYahooFinance === true)
    .map((quote) => ({
      symbol: quote.symbol,
      name: quote.shortname ?? quote.longname,
      quoteType: quote.quoteType,
    }));
}
