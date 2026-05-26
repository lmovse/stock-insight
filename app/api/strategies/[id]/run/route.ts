import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 10;

const aiOptions = {
  baseURL: process.env.OPENAI_BASE_URL ?? "",
  apiKey: process.env.OPENAI_API_KEY ?? "",
  model: process.env.OPENAI_MODEL ?? "gpt-4",
};

function buildPromptMessages(promptTemplate: string, stockCode: string, dateRange: string, klineData: string, criteria: string) {
  const userContent = promptTemplate
    .replace("{{stockCode}}", stockCode)
    .replace("{{dateRange}}", dateRange)
    .replace("{{klineData}}", klineData)
    .replace("{{criteria}}", criteria);

  return [
    { role: "system", content: userContent },
    {
      role: "user",
      content: `股票代码: ${stockCode}\n日期区间: ${dateRange}\nK线数据:\n${klineData}`,
    },
  ];
}

function formatKLineData(data: { date: number; open: number; high: number; low: number; close: number; volume: number }[]) {
  const header = "日期,开,高,低,收,成交量";
  const rows = data.map((d) => `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume}`);
  return [header, ...rows].join("\n");
}

async function callAI(messages: { role: string; content: string }[], options: typeof aiOptions, timeoutMs = 120000) {
  const url = `${options.baseURL}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI call failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content ?? "" };
}

function parseAIResponse(content: string) {
  const match = content.match(/结果[：:]\s*(符合|不符合|错误)/i);
  const reasonMatch = content.match(/原因[：:]\s*([\s\S]+?)(?=结果|用户|$)/i);

  if (match) {
    return {
      result: match[1] === "符合" ? "compliant" : match[1] === "不符合" ? "non-compliant" : "error",
      reason: reasonMatch ? reasonMatch[1].trim() : content.slice(0, 200),
    };
  }

  if (content.includes("符合") && !content.includes("不符合")) {
    return { result: "compliant", reason: content.slice(0, 200) };
  }
  if (content.includes("不符合")) {
    return { result: "non-compliant", reason: content.slice(0, 200) };
  }
  return { result: "error", reason: content.slice(0, 200) };
}

function codeToTsCode(code: string) {
  if (code.includes(".")) return code;
  const c = code.startsWith("0") || code.startsWith("3") ? "SZ" : code.startsWith("4") || code.startsWith("8") ? "BJ" : "SH";
  return `${code}.${c}`;
}

async function getKLineData(code: string) {
  const tsCode = codeToTsCode(code);
  const candles = await prisma.dailyCandle.findMany({
    where: { tsCode },
    orderBy: { tradeDate: "desc" },
    take: 300,
  });
  return candles.reverse().map((c) => ({
    date: parseInt(c.tradeDate),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.vol,
    amount: c.amount ?? undefined,
  }));
}

async function processStock(runId: string, stockCode: string, startDate: string, endDate: string, promptTemplate: string, criteria: string) {
  await prisma.strategyRunResult.updateMany({
    where: { runId, stockCode },
    data: { status: "running" },
  });

  try {
    const allData = await getKLineData(stockCode);
    console.log(`[${runId}] ${stockCode}: DB returned ${allData.length} records`);

    const start = parseInt(startDate.replace(/-/g, ""));
    const end = parseInt(endDate.replace(/-/g, ""));

    const klineData = allData.filter((d) => d.date >= start && d.date <= end);
    console.log(`[${runId}] ${stockCode}: filtered ${klineData.length} records in range ${start}-${end}`);

    if (klineData.length === 0) {
      await prisma.strategyRunResult.updateMany({
        where: { runId, stockCode },
        data: { status: "error", result: "error", reason: "指定区间无数据" },
      });
      return { stockCode, status: "error" };
    }

    const klineText = formatKLineData(klineData);
    const dateRange = `${startDate} ~ ${endDate}`;
    const messages = buildPromptMessages(promptTemplate, stockCode, dateRange, klineText, criteria);

    const aiResponse = await callAI(messages, aiOptions);
    const parsed = parseAIResponse(aiResponse.content);

    await prisma.strategyRunResult.updateMany({
      where: { runId, stockCode },
      data: {
        status: parsed.result,
        result: parsed.result === "compliant" ? "符合" : parsed.result === "non-compliant" ? "不符合" : "错误",
        reason: parsed.reason,
      },
    });

    return { stockCode, status: parsed.result };
  } catch (err: any) {
    console.error(`[${runId}] ${stockCode}: error -`, err.message);
    await prisma.strategyRunResult.updateMany({
      where: { runId, stockCode },
      data: { status: "error", result: "error", reason: err.message },
    });
    return { stockCode, status: "error", error: err.message };
  }
}

// Async processing function - runs without blocking the request
async function runStrategy(runId: string) {
  console.log(`[${runId}] Starting processing`);

  if (!aiOptions.apiKey || !aiOptions.baseURL) {
    console.error(`[${runId}] AI configuration incomplete`);
    await prisma.strategyRun.update({
      where: { id: runId },
      data: { status: "failed", finishedAt: new Date() },
    });
    return;
  }

  const run = await prisma.strategyRun.findUnique({
    where: { id: runId },
    include: { strategy: { include: { prompt: true } } },
  });

  if (!run) {
    console.error(`[${runId}] Run not found`);
    return;
  }

  const stockCodes = JSON.parse(run.stockCodes);
  const promptTemplate = run.strategy.prompt.content;
  const criteria = run.strategy.criteria ?? "";

  let waitingResults = await prisma.strategyRunResult.findMany({
    where: { runId, status: "waiting" },
    orderBy: { stockCode: "asc" },
  });

  console.log(`[${runId}] Processing ${waitingResults.length} stocks in batches of ${BATCH_SIZE}`);

  for (let i = 0; i < waitingResults.length; i += BATCH_SIZE) {
    const currentRun = await prisma.strategyRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });

    if (currentRun?.status === "cancelled") {
      console.log(`[${runId}] Run was cancelled, stopping`);
      break;
    }

    const batch = waitingResults.slice(i, i + BATCH_SIZE);
    console.log(`[${runId}] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map((b) => b.stockCode).join(", ")}`);

    const results = await Promise.allSettled(
      batch.map((b) => processStock(runId, b.stockCode, run.startDate, run.endDate, promptTemplate, criteria))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.status !== "error").length;
    const failed = results.filter((r) => r.status === "rejected" || r.value.status === "error").length;
    console.log(`[${runId}] Batch complete: ${succeeded} succeeded, ${failed} failed`);

    if (i + BATCH_SIZE < waitingResults.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const pendingCount = await prisma.strategyRunResult.count({
    where: { runId, status: { in: ["waiting", "running"] } },
  });

  const finalStatus = pendingCount === 0 ? "completed" : run.status;
  await prisma.strategyRun.update({
    where: { id: runId },
    data: { status: finalStatus, finishedAt: new Date() },
  });

  console.log(`[${runId}] Processing complete, status: ${finalStatus}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { stockCodes, startDate, endDate, dataConfig } = await req.json();

  if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
    return NextResponse.json({ error: "请选择股票" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "请选择日期区间" }, { status: 400 });
  }

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { prompt: true },
  });
  if (!strategy) return NextResponse.json({ error: "策略不存在" }, { status: 404 });

  // Create run record with status "running"
  const run = await prisma.strategyRun.create({
    data: {
      strategyId: id,
      stockCodes: JSON.stringify(stockCodes),
      startDate,
      endDate,
      dataConfig: JSON.stringify(dataConfig ?? { kline: true }),
      status: "running",
      startedAt: new Date(),
    },
  });

  // Create all result entries with status "waiting"
  await prisma.strategyRunResult.createMany({
    data: stockCodes.map((stockCode: string) => ({
      runId: run.id,
      stockCode,
      status: "waiting",
      result: null,
      reason: null,
    })),
  });

  // Run asynchronously - doesn't block the request
  runStrategy(run.id);

  return NextResponse.json({ taskId: run.id });
}