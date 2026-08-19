import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/market/yahoo";

export async function GET(request: NextRequest) {
  const tickers = (request.nextUrl.searchParams.get("tickers") ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0)
    return NextResponse.json({ error: "Missing tickers." }, { status: 400 });

  try {
    const quotes = await getQuotes(tickers);
    return NextResponse.json({ quotes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    );
  }
}
