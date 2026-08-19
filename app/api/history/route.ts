import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/market/yahoo";
import type { PriceHistory } from "@/lib/portfolio/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const tickers = (request.nextUrl.searchParams.get("tickers") ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const from = request.nextUrl.searchParams.get("from") ?? "";

  if (tickers.length === 0)
    return NextResponse.json({ error: "Missing tickers." }, { status: 400 });

  if (!DATE_PATTERN.test(from))
    return NextResponse.json(
      { error: "Missing or invalid 'from' date (expected YYYY-MM-DD)." },
      { status: 400 }
    );

  const histories: Record<string, PriceHistory> = {};
  const failures: Record<string, string> = {};

  // En lote en paralelo; nunca un request serial por ticker dentro de un loop.
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        histories[ticker] = await getHistory(ticker, from);
      } catch (err) {
        failures[ticker] = err instanceof Error ? err.message : "Unknown error";
      }
    })
  );

  if (Object.keys(histories).length === 0)
    return NextResponse.json(
      { error: "No data for the requested tickers.", failures },
      { status: 404 }
    );

  return NextResponse.json({ histories, failures });
}
