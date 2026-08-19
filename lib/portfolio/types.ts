/** Un lote de compra, ya sea real (del CSV) o sintetico (generado por una simulacion). */
export type Lot = {
  date: string; // ISO YYYY-MM-DD
  ticker: string;
  quantity: number;
  price: number;
  comment?: string;
};
