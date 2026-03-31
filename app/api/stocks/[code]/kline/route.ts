import { NextRequest, NextResponse } from "next/server";
import { getKLineData } from "@/lib/stockApi";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const period = req.nextUrl.searchParams.get("period") || "daily";
  const count = parseInt(req.nextUrl.searchParams.get("count") || "300");
  try {
    const data = await getKLineData(code, period, count);
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[stocks/${code}/kline] Failed to fetch K-line data:`, e);
    return NextResponse.json({ error: "Failed to fetch K-line" }, { status: 500 });
  }
}
