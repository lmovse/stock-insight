import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAI, buildPromptMessages, formatKLineData } from "@/lib/ai";
import { getKLineData } from "@/lib/stockApi";
import { setCancelFlag, isCancelled, clearCancelFlag } from "../../cancel/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { taskId } = await params;

  const run = await prisma.strategyRun.findFirst({
    where: { id: taskId, userId: user.id },
    include: { strategy: { include: { prompt: true } } },
  });
  if (!run) {
    return NextResponse.json({ error: "运行不存在" }, { status: 404 });
  }

  // Mark as running
  await prisma.strategyRun.update({
    where: { id: taskId },
    data: { status: "running", startedAt: new Date() },
  });

  const stockCodes: string[] = JSON.parse(run.stockCodes);
  const total = stockCodes.length;
  const dateRange = `${run.startDate} ~ ${run.endDate}`;
  const promptTemplate = run.strategy.prompt.content;

  const aiOptions = {
    baseURL: process.env.OPENAI_BASE_URL ?? "",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4",
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let done = 0;

      for (const stockCode of stockCodes) {
        if (isCancelled(taskId)) {
          send("done", { status: "cancelled", summary: `已取消，${done}/${total} 支完成` });
          break;
        }

        send("progress", { done, total, currentStock: stockCode });

        try {
          // Import codeToTsCode dynamically to avoid circular dependency
          const { default: stockApi } = await import("@/lib/stockApi");
          const codeToTsCode = (code: string): string => {
            const c = code.startsWith("0") || code.startsWith("3") ? "SZ" : code.startsWith("4") || code.startsWith("8") ? "BJ" : "SH";
            return `${code}.${c}`;
          };

          const tsCode = codeToTsCode(stockCode);
          const allData = await getKLineData(stockCode, "daily", 300);

          const start = parseInt(run.startDate.replace(/-/g, ""));
          const end = parseInt(run.endDate.replace(/-/g, ""));

          const klineData = allData.filter((d: { date: number }) => d.date >= start && d.date <= end);
          const klineText = formatKLineData(klineData);

          const messages = buildPromptMessages(promptTemplate, stockCode, dateRange, klineText);

          const aiResponse = await callAI(messages, aiOptions);

          const parsed = parseAIResponse(aiResponse.content);

          await prisma.strategyRunResult.create({
            data: {
              runId: taskId,
              stockCode,
              result: parsed.result,
              reason: parsed.reason,
              rawResponse: aiResponse.content,
            },
          });

          send("result", { stockCode, result: parsed.result, reason: parsed.reason });

          done++;
          send("progress", { done, total, currentStock: stockCode });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";

          await prisma.strategyRunResult.create({
            data: {
              runId: taskId,
              stockCode,
              result: "错误",
              reason: errorMsg,
              rawResponse: null,
            },
          });

          send("result", { stockCode, result: "错误", reason: errorMsg });
          done++;
        }
      }

      if (!isCancelled(taskId)) {
        await prisma.strategyRun.update({
          where: { id: taskId },
          data: { status: "completed", finishedAt: new Date() },
        });
        send("done", { status: "completed", summary: `完成，${done}/${total} 支` });
      }

      clearCancelFlag(taskId);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function parseAIResponse(content: string): { result: string; reason: string } {
  const match = content.match(/结果[：:]\s*(符合|不符合|错误)/i);
  const reasonMatch = content.match(/原因[：:]\s*([\s\S]+?)(?=结果|用户|$)/i);

  if (match) {
    return {
      result: match[1] === "符合" ? "符合" : match[1] === "不符合" ? "不符合" : "错误",
      reason: reasonMatch ? reasonMatch[1].trim() : content.slice(0, 200),
    };
  }

  if (content.includes("符合") && !content.includes("不符合")) {
    return { result: "符合", reason: content.slice(0, 200) };
  }
  if (content.includes("不符合")) {
    return { result: "不符合", reason: content.slice(0, 200) };
  }
  return { result: "错误", reason: content.slice(0, 200) };
}
