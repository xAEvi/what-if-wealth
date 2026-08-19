import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/lib/market/yahoo";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!query)
    return NextResponse.json({ error: "Missing query." }, { status: 400 });

  try {
    const results = await searchTickers(query);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    );
  }
}
