import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import path from "path";
import { analyzeScriptResult } from "@/lib/ai";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, ...extraParams } = await req.json();

  let strategy;
  try {
    strategy = await prisma.scriptStrategy.findUnique({ where: { id } });
  } catch (err) {
    return NextResponse.json({ error: "数据库查询失败" }, { status: 500 });
  }
  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  // 验证脚本路径，防止路径遍历
  if (strategy.scriptPath.includes("..")) {
    return NextResponse.json({ error: "无效的脚本路径" }, { status: 400 });
  }

  // 创建运行记录
  const runParams = JSON.stringify({ date, ...extraParams });
  let run;
  try {
    run = await prisma.scriptRun.create({
      data: { scriptStrategyId: id, params: runParams, status: "running" },
    });
  } catch (err) {
    return NextResponse.json({ error: "创建运行记录失败" }, { status: 500 });
  }

  // 异步执行脚本，使用绝对路径
  const scriptPath = path.join(process.cwd(), "scripts", strategy.scriptPath);
  const args = [scriptPath];
  if (date) args.push("--date", date);

  const execPromise = new Promise<string>((resolve, reject) => {
    const proc = spawn("python", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exit code ${code}`));
    });
    proc.on("error", reject);
  });

  // 立即返回，后台执行
  execPromise
    .then(async (result) => {
      // Get AI config (same pattern as existing strategy run)
      const aiOptions = {
        baseURL: process.env.OPENAI_BASE_URL ?? "",
        apiKey: process.env.OPENAI_API_KEY ?? "",
        model: process.env.OPENAI_MODEL ?? "gpt-4",
      };

      // Call AI analysis if configured
      let analysis = null;
      if (aiOptions.apiKey && aiOptions.baseURL) {
        analysis = await analyzeScriptResult(strategy.name, result, aiOptions);
      }

      await prisma.scriptRun.update({
        where: { id: run.id },
        data: { status: "completed", result, analysis, finishedAt: new Date() },
      });
    })
    .catch(async (err) => {
      await prisma.scriptRun.update({
        where: { id: run.id },
        data: { status: "failed", error: err.message, finishedAt: new Date() },
      });
    })
    .catch((err) => {
      // 避免未处理的拒绝（但update失败已记录到run.status）
      console.error("Script run update failed:", err);
    });

  return NextResponse.json({ runId: run.id });
}
