import type {
  Lot,
  PriceBar,
  PriceHistory,
  PortfolioSeries,
  SeriesPoint,
} from "./types";

/**
 * Busca la ultima barra en o antes de `date`, para el forward fill de la serie.
 * Devuelve null si el historico todavia no llega a esa fecha.
 */
export function lastBarAsOf(
  history: PriceHistory,
  date: string
): PriceBar | null {
  const bars = history.bars;
  let lo = 0;
  let hi = bars.length - 1;
  let result: PriceBar | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].date <= date) {
      result = bars[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/**
 * Busca la primera barra en o despues de `date`, para los lotes que caen en
 * feriado. Devuelve null si se paso del final del historico.
 */
export function resolveBar(
  history: PriceHistory,
  date: string
): PriceBar | null {
  const bars = history.bars;
  let lo = 0;
  let hi = bars.length - 1;
  let result: PriceBar | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].date >= date) {
      result = bars[mid];
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return result;
}

type NormalizedLot = {
  lot: Lot;
  adjustedQuantity: number;
  capital: number;
};

// La cantidad del CSV esta en terminos pre-split; el factor implicito de la barra
// del dia de compra la lleva a terminos ajustados para valuar con adjClose.
function normalize(lot: Lot, history?: PriceHistory): NormalizedLot {
  const capital = lot.quantity * lot.price;
  const bar = history ? lastBarAsOf(history, lot.date) : null;
  const factor = bar && bar.close !== 0 ? bar.adjClose / bar.close : 1;
  const adjustedQuantity = factor === 0 ? 0 : lot.quantity / factor;

  return { lot, adjustedQuantity, capital };
}

// Union ordenada de las fechas de todos los historicos: no hay un solo calendario
// de mercado (BTC cotiza los 7 dias, los ETFs de lunes a viernes).
function mergeCalendars(
  histories: Record<string, PriceHistory>
): Array<string> {
  const dates = new Set<string>();
  for (const history of Object.values(histories)) {
    for (const bar of history.bars) dates.add(bar.date);
  }
  return [...dates].sort();
}

/** Valor de la posicion de un lote en `date`, con forward fill de su historico. */
function valueAt(
  normalized: NormalizedLot,
  history: PriceHistory,
  date: string
): number {
  const bar = lastBarAsOf(history, date);
  return bar ? normalized.adjustedQuantity * bar.adjClose : 0;
}

/**
 * Construye la serie de valor e inversion acumulada, dia a dia, recorriendo la
 * union de fechas de los historicos involucrados.
 */
export function buildSeries(
  lots: Array<Lot>,
  histories: Record<string, PriceHistory>,
  label: string
): PortfolioSeries {
  const normalized = lots
    .map((lot) => normalize(lot, histories[lot.ticker]))
    .filter((entry) => histories[entry.lot.ticker]);

  const timeline = mergeCalendars(histories);
  const points: Array<SeriesPoint> = [];

  for (const date of timeline) {
    let invested = 0;
    let value = 0;

    for (const entry of normalized) {
      if (entry.lot.date > date) continue;

      // El capital invertido se suma sin ajustar; el valor usa la cantidad ajustada.
      invested += entry.capital;
      value += valueAt(entry, histories[entry.lot.ticker], date);
    }

    const growthPct =
      invested === 0 ? 0 : ((value - invested) / invested) * 100;
    points.push({ date, invested, value, growthPct });
  }

  const totalInvested = points.length ? points[points.length - 1].invested : 0;
  const finalValue = points.length ? points[points.length - 1].value : 0;
  const growthPct =
    totalInvested === 0
      ? 0
      : ((finalValue - totalInvested) / totalInvested) * 100;

  return { label, points, totalInvested, finalValue, growthPct };
}

/**
 * Reemplaza los lotes de un ticker por lotes del destino, preservando el capital:
 * cero capital compra cero acciones, asi los lotes de costo cero desaparecen.
 */
export function substituteTicker(
  lots: Array<Lot>,
  from: string,
  to: PriceHistory
): Array<Lot> {
  return lots.flatMap((lot) => {
    if (lot.ticker !== from) return [lot];

    const bar = resolveBar(to, lot.date);
    if (!bar) return [];

    const capital = lot.quantity * lot.price;
    return [
      {
        ...lot,
        ticker: to.ticker,
        quantity: capital / bar.close,
        price: bar.close,
      },
    ];
  });
}

/**
 * Reparte el capital de cada lote entre varios tickers segun los pesos (porcentajes).
 * Los pesos deben sumar 100; eso se valida en el borde, no aca dentro.
 */
export function distribute(
  lots: Array<Lot>,
  weights: Array<{ ticker: string; weight: number }>,
  histories: Record<string, PriceHistory>
): Array<Lot> {
  const result: Array<Lot> = [];

  for (const lot of lots) {
    const capital = lot.quantity * lot.price;

    for (const { ticker, weight } of weights) {
      if (weight <= 0) continue;

      const history = histories[ticker];
      const bar = history ? resolveBar(history, lot.date) : null;
      if (!bar) continue;

      const share = capital * (weight / 100);
      result.push({
        ...lot,
        ticker,
        quantity: share / bar.close,
        price: bar.close,
      });
    }
  }
  return result;
}

export type Position = {
  ticker: string;
  invested: number;
  value: number;
  growthPct: number;
};

/** Desglose por ticker: capital, valor de mercado y crecimiento de cada posicion. */
export function positionBreakdown(
  lots: Array<Lot>,
  histories: Record<string, PriceHistory>
): Array<Position> {
  const totals = new Map<string, { invested: number; value: number }>();

  for (const lot of lots) {
    const history = histories[lot.ticker];
    if (!history) continue;

    const entry = totals.get(lot.ticker) ?? { invested: 0, value: 0 };
    const normalized = normalize(lot, history);
    const lastBar = history.bars[history.bars.length - 1];

    entry.invested += normalized.capital;
    if (lastBar) entry.value += normalized.adjustedQuantity * lastBar.adjClose;
    totals.set(lot.ticker, entry);
  }

  return [...totals.entries()]
    .map(([ticker, { invested, value }]) => ({
      ticker,
      invested,
      value,
      growthPct: invested === 0 ? 0 : ((value - invested) / invested) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Valor de mercado actual, valuando la cantidad ajustada con la cotizacion en vivo. */
export function valueWithQuotes(
  lots: Array<Lot>,
  histories: Record<string, PriceHistory>,
  quotes: Record<string, number>
): number {
  let total = 0;

  for (const lot of lots) {
    const history = histories[lot.ticker];
    const quote = quotes[lot.ticker];
    if (!history || quote == null) continue;

    total += normalize(lot, history).adjustedQuantity * quote;
  }
  return total;
}
