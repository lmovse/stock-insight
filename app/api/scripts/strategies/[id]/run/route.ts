import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import path from "path";
import { existsSync } from "fs";
import { analyzeScriptResult } from "@/lib/ai";
import { addAILog } from "@/lib/aiLog";

const VENV_PYTHON = path.resolve(process.cwd(), ".venv/bin/python");
const PYTHON_CMD = existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3";

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
  const defaultParams = strategy.params ? JSON.parse(strategy.params) : {};
  const runParams = JSON.stringify({ ...defaultParams, date, ...extraParams });
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
    const proc = spawn(PYTHON_CMD, args);
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
      // 即使脚本成功执行，AI分析失败也不应影响最终状态
      let analysis = null;
      const aiOptions = {
        baseURL: process.env.OPENAI_BASE_URL ?? "",
        apiKey: process.env.OPENAI_API_KEY ?? "",
        model: process.env.OPENAI_MODEL ?? "gpt-4",
      };

      if (aiOptions.apiKey && aiOptions.baseURL) {
        try {
          analysis = await analyzeScriptResult(strategy.name, result, aiOptions);
          // 记录 AI 日志
          addAILog({
            runId: run.id,
            stockCode: "", // 脚本运行无单股票概念
            messages: [], // analyzeScriptResult 内部构建消息，不对外暴露
            response: analysis,
          });
        } catch (aiErr: unknown) {
          // AI 分析失败不影响脚本运行状态，仅记录错误
          console.error(`[${run.id}] AI analysis failed:`, aiErr instanceof Error ? aiErr.message : String(aiErr));
        }
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
      console.error(`[${run.id}] Script execution failed:`, err.message);
    });

  return NextResponse.json({ runId: run.id });
}
