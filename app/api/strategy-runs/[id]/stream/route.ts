import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAI, buildPromptMessages, formatKLineData } from "@/lib/ai";
import { getKLineData } from "@/lib/stockApi";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const run = await prisma.strategyRun.findFirst({
    where: { id, userId: user.id },
    include: { strategy: { include: { prompt: true } } },
  });
  if (!run) {
    return NextResponse.json({ error: "运行不存在" }, { status: 404 });
  }

  // Mark as running
  await prisma.strategyRun.update({
    where: { id },
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

      // Check if cancelled via DB status
      const checkCancelled = async (): Promise<boolean> => {
        const r = await prisma.strategyRun.findUnique({
          where: { id },
          select: { status: true },
        });
        return r?.status === "cancelled";
      };

      for (const stockCode of stockCodes) {
        // Check cancellation before starting each stock
        if (await checkCancelled()) {
          send("done", { status: "cancelled", summary: `已取消，${done}/${total} 支完成` });
          break;
        }

        send("progress", { done, total, currentStock: stockCode });

        try {
          // Get K-line data
          const allData = await getKLineData(stockCode, "daily", 300);

          const start = parseInt(run.startDate.replace(/-/g, ""));
          const end = parseInt(run.endDate.replace(/-/g, ""));

          const klineData = allData.filter((d: { date: number }) => d.date >= start && d.date <= end);
          const klineText = formatKLineData(klineData);

          const messages = buildPromptMessages(promptTemplate, stockCode, dateRange, klineText);

          // Create AbortController for this AI call
          const abortController = new AbortController();

          // Poll for cancellation during AI call (every 2 seconds)
          const pollCancelled = setInterval(async () => {
            if (await checkCancelled()) {
              abortController.abort();
            }
          }, 2000);

          try {
            const aiResponse = await callAI(messages, aiOptions, abortController.signal);
            clearInterval(pollCancelled);

            const parsed = parseAIResponse(aiResponse.content);

            await prisma.strategyRunResult.create({
              data: {
                runId: id,
                stockCode,
                result: parsed.result,
                reason: parsed.reason,
                rawResponse: aiResponse.content,
              },
            });

            send("result", { stockCode, result: parsed.result, reason: parsed.reason });
          } catch (err) {
            clearInterval(pollCancelled);

            // Check if it was aborted
            if (err instanceof Error && err.name === "AbortError") {
              send("done", { status: "cancelled", summary: `已取消，${done}/${total} 支完成` });
              break;
            }
            throw err;
          }

          done++;
          send("progress", { done, total, currentStock: stockCode });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";

          await prisma.strategyRunResult.create({
            data: {
              runId: id,
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

      // Final status update
      const finalStatus = await checkCancelled() ? "cancelled" : "completed";
      if (finalStatus === "completed") {
        await prisma.strategyRun.update({
          where: { id },
          data: { status: "completed", finishedAt: new Date() },
        });
      }
      send("done", { status: finalStatus, summary: `完成，${done}/${total} 支` });

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
