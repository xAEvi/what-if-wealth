import { describe, expect, it } from "vitest";
import {
  buildSeries,
  distribute,
  lastBarAsOf,
  lotValueWithQuote,
  positionBreakdown,
  replaceAll,
  replaceAllWithDetails,
  replaceTickerWithDetails,
  resolveBar,
  substituteTicker,
  valueWithQuotes,
} from "./engine";
import type { Lot, PriceBar, PriceHistory } from "./types";

const bar = (date: string, close: number, adjClose = close): PriceBar => ({
  date,
  close,
  adjClose,
});

const history = (ticker: string, bars: Array<PriceBar>): PriceHistory => ({
  ticker,
  firstTradeDate: bars[0].date,
  bars,
});

describe("lastBarAsOf", () => {
  const h = history("X", [
    bar("2024-01-05", 10), // viernes
    bar("2024-01-08", 11), // lunes
  ]);

  it("devuelve la barra exacta en la fecha", () => {
    expect(lastBarAsOf(h, "2024-01-08")?.close).toBe(11);
  });

  it("hace forward fill para una fecha que no cotiza (fin de semana)", () => {
    // Sabado 06 no hay barra: debe devolver el cierre del viernes 05.
    expect(lastBarAsOf(h, "2024-01-06")?.close).toBe(10);
  });

  it("devuelve null si el historico no llega a la fecha", () => {
    expect(lastBarAsOf(h, "2023-12-01")).toBeNull();
  });
});

describe("resolveBar", () => {
  const h = history("X", [bar("2024-01-02", 10), bar("2024-01-03", 11)]);

  it("devuelve la primera barra en o despues de la fecha", () => {
    expect(resolveBar(h, "2024-01-02")?.close).toBe(10);
  });

  it("salta feriados hacia adelante", () => {
    // 2024-01-01 es feriado (Año Nuevo), la primera barra es el 02.
    expect(resolveBar(h, "2024-01-01")?.date).toBe("2024-01-02");
  });

  it("devuelve null si se paso del final del historico", () => {
    expect(resolveBar(h, "2025-01-01")).toBeNull();
  });
});

describe("buildSeries", () => {
  it("ajusta por un split 4:1 sin perder capital", () => {
    const split = history("SPLIT", [
      bar("2024-01-02", 100, 25),
      bar("2024-01-03", 25, 25),
    ]);
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "SPLIT", quantity: 10, price: 100 },
    ];

    const series = buildSeries(lots, { SPLIT: split }, "split");

    // Sin ajuste, 10 acciones * 25 = 250; ajustado quedan 40 acciones * 25 = 1000.
    expect(series.totalInvested).toBe(1000);
    expect(series.finalValue).toBe(1000);
    expect(series.points.at(-1)?.value).toBe(1000);
  });

  it("valora un lote comprado en feriado con forward fill", () => {
    const etf = history("ETF", [
      bar("2024-01-05", 10), // viernes
      bar("2024-01-08", 11), // lunes
    ]);
    // 2024-01-06 es sabado, no cotiza.
    const lots: Array<Lot> = [
      { date: "2024-01-06", ticker: "ETF", quantity: 1, price: 10 },
    ];

    const series = buildSeries(lots, { ETF: etf }, "holiday");

    expect(series.finalValue).toBe(11);
    expect(series.totalInvested).toBe(10);
  });

  it("une calendarios de cripto (7 dias) y ETF (lunes a viernes)", () => {
    const btc = history("BTC", [
      bar("2024-01-05", 100),
      bar("2024-01-06", 102),
      bar("2024-01-07", 104),
      bar("2024-01-08", 106),
    ]);
    const etf = history("ETF", [bar("2024-01-05", 10), bar("2024-01-08", 11)]);
    const lots: Array<Lot> = [
      { date: "2024-01-05", ticker: "BTC", quantity: 1, price: 100 },
      { date: "2024-01-05", ticker: "ETF", quantity: 1, price: 10 },
    ];

    const series = buildSeries(lots, { BTC: btc, ETF: etf }, "mixed");
    const dates = series.points.map((p) => p.date);

    expect(dates).toEqual([
      "2024-01-05",
      "2024-01-06",
      "2024-01-07",
      "2024-01-08",
    ]);

    const sunday = series.points.find((p) => p.date === "2024-01-07");
    // Domingo: BTC cotiza (104) y el ETF se congela en su cierre del viernes (10).
    expect(sunday?.value).toBeCloseTo(114);
    expect(sunday?.invested).toBe(110);

    const monday = series.points.find((p) => p.date === "2024-01-08");
    expect(monday?.value).toBeCloseTo(117);
  });
});

describe("substituteTicker", () => {
  it("preserva el capital del lote reemplazado", () => {
    const target = history("B", [bar("2024-01-02", 50)]);
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "A", quantity: 10, price: 100 },
    ];

    const substituted = substituteTicker(lots, "A", target);

    expect(substituted).toHaveLength(1);
    expect(substituted[0].ticker).toBe("B");
    expect(substituted[0].quantity).toBe(20); // 1000 / 50
    expect(substituted[0].price).toBe(50);
    expect(substituted[0].quantity * substituted[0].price).toBe(1000);
  });

  it("desaparece los lotes de costo cero (capital cero compra cero acciones)", () => {
    const target = history("B", [bar("2024-01-02", 50)]);
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "A", quantity: 9e-6, price: 0 },
    ];

    const substituted = substituteTicker(lots, "A", target);

    expect(substituted[0].quantity).toBe(0);
  });
});

describe("distribute", () => {
  it("reparte el capital segun los pesos sin perderlo", () => {
    const histories = {
      B: history("B", [bar("2024-01-02", 50)]),
      C: history("C", [bar("2024-01-02", 25)]),
    };
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "A", quantity: 10, price: 100 },
    ];
    const weights = [
      { ticker: "B", weight: 60 },
      { ticker: "C", weight: 40 },
    ];

    const distributed = distribute(lots, weights, histories);

    expect(distributed).toHaveLength(2);
    const b = distributed.find((l) => l.ticker === "B");
    const c = distributed.find((l) => l.ticker === "C");
    expect(b?.quantity).toBe(12); // 600 / 50
    expect(c?.quantity).toBe(16); // 400 / 25

    const totalCapital = distributed.reduce(
      (sum, l) => sum + l.quantity * l.price,
      0
    );
    expect(totalCapital).toBe(1000);
  });
});

describe("replaceAll", () => {
  it("convierte todos los lotes al destino preservando el capital total", () => {
    const target = history("D", [bar("2024-01-02", 50), bar("2024-01-03", 25)]);
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "A", quantity: 10, price: 100 },
      { date: "2024-01-03", ticker: "B", quantity: 5, price: 50 },
    ];

    const replaced = replaceAll(lots, target);

    expect(replaced).toHaveLength(2);
    expect(replaced.every((lot) => lot.ticker === "D")).toBe(true);
    expect(replaced[0].quantity).toBe(20); // 1000 / 50
    expect(replaced[1].quantity).toBe(10); // 250 / 25

    const totalCapital = replaced.reduce(
      (sum, lot) => sum + lot.quantity * lot.price,
      0
    );
    expect(totalCapital).toBe(1250); // 1000 + 250
  });
});

describe("replaceTickerWithDetails", () => {
  it("empareja cada lote sustituido con su reemplazo, preservando el capital", () => {
    const target = history("B", [bar("2024-01-02", 50)]);
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "A", quantity: 10, price: 100 },
      { date: "2024-01-02", ticker: "C", quantity: 2, price: 20 },
    ];

    const pairs = replaceTickerWithDetails(lots, "A", target);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].original.ticker).toBe("A");
    expect(pairs[0].replacement.ticker).toBe("B");
    expect(pairs[0].replacement.quantity).toBe(20);
    expect(pairs[0].replacement.quantity * pairs[0].replacement.price).toBe(
      1000
    );
  });
});

describe("replaceAllWithDetails", () => {
  it("empareja todos los lotes, no solo los de un ticker", () => {
    const target = history("D", [bar("2024-01-02", 50)]);
    const lots: Array<Lot> = [
      { date: "2024-01-02", ticker: "A", quantity: 10, price: 100 },
      { date: "2024-01-02", ticker: "B", quantity: 4, price: 50 },
    ];

    const pairs = replaceAllWithDetails(lots, target);

    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => pair.replacement.ticker === "D")).toBe(true);
  });
});

describe("positionBreakdown", () => {
  const histories = {
    BTC: history("BTC", [bar("2024-01-05", 100), bar("2024-01-08", 110)]),
    ETF: history("ETF", [bar("2024-01-05", 10), bar("2024-01-08", 12)]),
  };
  const lots: Array<Lot> = [
    { date: "2024-01-05", ticker: "BTC", quantity: 1, price: 100 },
    { date: "2024-01-05", ticker: "ETF", quantity: 2, price: 10 },
  ];

  it("calcula valor, capital y crecimiento por posicion", () => {
    const positions = positionBreakdown(lots, histories);
    const btc = positions.find((p) => p.ticker === "BTC");
    const etf = positions.find((p) => p.ticker === "ETF");

    expect(btc?.value).toBe(110);
    expect(btc?.invested).toBe(100);
    expect(btc?.growthPct).toBe(10);
    expect(etf?.value).toBe(24);
    expect(etf?.invested).toBe(20);
  });

  it("ordena por valor descendente", () => {
    const positions = positionBreakdown(lots, histories);
    expect(positions.map((p) => p.ticker)).toEqual(["BTC", "ETF"]);
  });
});

describe("valueWithQuotes", () => {
  it("valua la cantidad ajustada con la cotizacion en vivo", () => {
    const histories = {
      BTC: history("BTC", [bar("2024-01-05", 100), bar("2024-01-08", 110)]),
      ETF: history("ETF", [bar("2024-01-05", 10), bar("2024-01-08", 12)]),
    };
    const lots: Array<Lot> = [
      { date: "2024-01-05", ticker: "BTC", quantity: 1, price: 100 },
      { date: "2024-01-05", ticker: "ETF", quantity: 2, price: 10 },
    ];

    const total = valueWithQuotes(lots, histories, { BTC: 115, ETF: 13 });

    expect(total).toBe(141); // 1*115 + 2*13
  });
});

describe("lotValueWithQuote", () => {
  it("valua un lote individual ajustando por split", () => {
    // Factor 0.25 por un split 4:1: 10 acciones pre-split -> 40 ajustadas.
    const split = history("SPLIT", [
      bar("2024-01-02", 100, 25),
      bar("2024-01-03", 25, 25),
    ]);
    const lot: Lot = {
      date: "2024-01-02",
      ticker: "SPLIT",
      quantity: 10,
      price: 100,
    };

    expect(lotValueWithQuote(lot, split, 30)).toBe(1200); // 40 * 30
  });
});
