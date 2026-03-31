import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/stockApi";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q) return NextResponse.json([]);
  try {
    const results = await searchStocks(q);
    return NextResponse.json(results);
  } catch (e) {
    console.error(`[stocks/search] Failed to search stocks:`, e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
