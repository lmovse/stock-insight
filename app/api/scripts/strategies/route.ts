import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET() {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const strategies = await prisma.scriptStrategy.findMany({
    where: {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { name, description, scriptPath, params } = await req.json();
  if (!name || !scriptPath) {
    return NextResponse.json({ error: "名称和脚本路径不能为空" }, { status: 400 });
  }

  const strategy = await prisma.scriptStrategy.create({
    data: {
      userId: user.id,
      name,
      description,
      scriptPath,
      params,
    },
  });

  return NextResponse.json(strategy);
}
