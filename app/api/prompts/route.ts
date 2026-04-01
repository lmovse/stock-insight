import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prompts = await prisma.prompt.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const { name, content } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: "名称和内容不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: { name, content },
  });

  return NextResponse.json(prompt);
}
