import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { runFullSync, syncMinuteCandles } from "@/lib/tushare/sync";

const prisma = new PrismaClient();

// GET /api/stocks/sync - Get current data cutoff date
export async function GET(_req: NextRequest) {
  try {
    const latestCandle = await prisma.dailyCandle.findFirst({
      orderBy: { tradeDate: "desc" },
      select: { tradeDate: true },
    });

    return NextResponse.json({
      cutoffDate: latestCandle?.tradeDate || null,
      hasData: !!latestCandle,
    });
  } catch (e) {
    console.error("[api/stocks/sync] Failed to get cutoff date:", e);
    return NextResponse.json({ error: "Failed to get cutoff date" }, { status: 500 });
  }
}

// POST /api/stocks/sync - Trigger full sync
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type || "all"; // "daily" | "minute" | "all"

    if (type === "all" || type === "daily") {
      runFullSync().catch((err) => console.error("[sync] daily failed:", err));
    }
    if (type === "all" || type === "minute") {
      syncMinuteCandles().catch((err) => console.error("[sync] minute failed:", err));
    }

    return NextResponse.json({ message: "Sync started", type });
  } catch (e) {
    console.error("[api/stocks/sync] Failed to start sync:", e);
    return NextResponse.json({ error: "Failed to start sync" }, { status: 500 });
  }
}
