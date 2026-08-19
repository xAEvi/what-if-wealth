import Papa from "papaparse";
import type { Lot } from "@/lib/portfolio/types";

/** Error por fila, con el numero de linea del archivo original. */
export type CsvRowError = {
  line: number;
  message: string;
};

export type ParseResult = {
  lots: Lot[];
  errors: CsvRowError[];
};

const REQUIRED_HEADERS = [
  "Symbol",
  "Trade Date",
  "Purchase Price",
  "Quantity",
  "Transaction Type",
];

const ACCEPTED_TRANSACTION_TYPES = new Set(["BUY"]);

/**
 * Convierte YYYYMMDD a ISO YYYY-MM-DD. No se pasa el string crudo a Date
 * porque lo interpreta como fecha UTC y despues lo lee con offset local.
 */
function parseTradeDate(raw: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(raw.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isValid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);

  return isValid ? `${year}-${month}-${day}` : null;
}

/** Indexa los headers normalizados a minusculas para tolerar variaciones de caja. */
function buildHeaderIndex(headerRow: Array<string>): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const key = cell.trim().toLowerCase();
    if (key) index.set(key, i);
  });
  return index;
}

/** True si la fila no tiene ningun valor, para saltarla sin contarla como error. */
function isEmptyRow(row: Array<string>): boolean {
  return row.every((cell) => !cell?.trim());
}

export function parsePortfolioCsv(raw: string): ParseResult {
  // BOM de UTF-8 contamina el primer header si no se limpia antes de parsear.
  const text = raw.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Array<string>>(text, {
    delimiter: ",",
    dynamicTyping: false,
    skipEmptyLines: false,
  });

  const rows = parsed.data;
  if (rows.length === 0)
    return { lots: [], errors: [{ line: 1, message: "The file is empty." }] };

  const headerIndex = buildHeaderIndex(rows[0]);
  const missing = REQUIRED_HEADERS.filter(
    (header) => !headerIndex.has(header.toLowerCase())
  );
  if (missing.length > 0)
    return {
      lots: [],
      errors: [
        {
          line: 1,
          message: `Missing required column(s): ${missing.join(", ")}.`,
        },
      ],
    };

  const lots: Lot[] = [];
  const errors: CsvRowError[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i < rows.length; i++) {
    const line = i + 1;
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const cell = (header: string) =>
      row[headerIndex.get(header.toLowerCase())!] ?? "";

    const ticker = cell("Symbol").trim().toUpperCase();
    const transactionType = cell("Transaction Type").trim().toUpperCase();
    const rawDate = cell("Trade Date").trim();
    const rawQuantity = cell("Quantity").trim();
    const rawPrice = cell("Purchase Price").trim();
    const comment = cell("Comment").trim();

    if (!ticker) {
      errors.push({ line, message: "Symbol is empty." });
      continue;
    }

    if (!ACCEPTED_TRANSACTION_TYPES.has(transactionType)) {
      errors.push({
        line,
        message: `Unsupported transaction type "${transactionType}". Only BUY is accepted.`,
      });
      continue;
    }

    const date = parseTradeDate(rawDate);
    if (!date) {
      errors.push({
        line,
        message: `Invalid Trade Date "${rawDate}". Expected YYYYMMDD.`,
      });
      continue;
    }

    if (date > today) {
      errors.push({
        line,
        message: `Trade Date "${rawDate}" is in the future.`,
      });
      continue;
    }

    const quantity = Number.parseFloat(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({
        line,
        message: `Invalid Quantity "${rawQuantity}". Must be greater than zero.`,
      });
      continue;
    }

    const price = Number.parseFloat(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      errors.push({
        line,
        message: `Invalid Purchase Price "${rawPrice}". Must be zero or greater.`,
      });
      continue;
    }

    lots.push({ date, ticker, quantity, price, comment: comment || undefined });
  }

  // Errores estructurales de PapaParse, con su numero de fila si lo reporta.
  parsed.errors.forEach((err) => {
    errors.push({
      line: (err.row ?? 0) + 1,
      message: `CSV parse error: ${err.message}`,
    });
  });

  return { lots, errors };
}
