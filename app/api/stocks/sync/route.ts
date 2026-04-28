import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { runFullSync } from "@/lib/tushare/sync";

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
export async function POST(_req: NextRequest) {
  try {
    // Run sync in background - don't await completion
    runFullSync().catch((err) => {
      console.error("[api/stocks/sync] Sync failed:", err);
    });

    return NextResponse.json({ message: "Sync started" });
  } catch (e) {
    console.error("[api/stocks/sync] Failed to start sync:", e);
    return NextResponse.json({ error: "Failed to start sync" }, { status: 500 });
  }
}
