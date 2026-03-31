import { NextRequest, NextResponse } from "next/server";
import { getStockInfo } from "@/lib/stockApi";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const info = await getStockInfo(code);
    return NextResponse.json(info);
  } catch (e) {
    console.error(`[stocks/${code}] Failed to fetch stock info:`, e);
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
