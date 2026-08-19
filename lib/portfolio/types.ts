/** Un lote de compra, ya sea real (del CSV) o sintetico (generado por una simulacion). */
export type Lot = {
  date: string; // ISO YYYY-MM-DD
  ticker: string;
  quantity: number;
  price: number;
  comment?: string;
};

/** Barra diaria de precio. `adjClose` viene ajustado por splits y dividendos. */
export type PriceBar = {
  date: string;
  close: number;
  adjClose: number;
};

export type PriceHistory = {
  ticker: string;
  firstTradeDate: string;
  bars: Array<PriceBar>; // ordenado ascendente por fecha
};
