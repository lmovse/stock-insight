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
  } catch {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }
}
