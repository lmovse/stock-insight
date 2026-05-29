import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, ...extraParams } = await req.json();

  const strategy = await prisma.scriptStrategy.findUnique({ where: { id } });
  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  // 创建运行记录
  const runParams = JSON.stringify({ date, ...extraParams });
  const run = await prisma.scriptRun.create({
    data: { scriptStrategyId: id, params: runParams, status: "running" },
  });

  // 异步执行脚本
  const scriptPath = path.join(process.cwd(), "scripts", strategy.scriptPath);
  const args = ["scripts/" + strategy.scriptPath];
  if (date) args.push("--date", date);

  const execPromise = new Promise<string>((resolve, reject) => {
    const proc = spawn("python", args, { cwd: process.cwd() });
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
      await prisma.scriptRun.update({
        where: { id: run.id },
        data: { status: "completed", result, finishedAt: new Date() },
      });
    })
    .catch(async (err) => {
      await prisma.scriptRun.update({
        where: { id: run.id },
        data: { status: "failed", error: err.message, finishedAt: new Date() },
      });
    });

  return NextResponse.json({ runId: run.id });
}
