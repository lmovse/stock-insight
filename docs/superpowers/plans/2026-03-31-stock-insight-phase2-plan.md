# Stock Insight Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build user authentication (email + JWT), watchlist management, and portfolio tracking with Prisma + SQLite.

**Architecture:** Next.js API Routes with Prisma ORM + SQLite. JWT stored in httpOnly cookie. Client state managed with React Context.

**Tech Stack:** Next.js 16, Prisma, SQLite, jose (JWT), bcryptjs (password hashing).

---

## File Structure

```
prisma/
  schema.prisma        # Database schema

lib/
  prisma.ts            # Prisma client singleton
  auth.ts              # JWT utilities (sign, verify, getUser)
  password.ts          # bcrypt helpers

app/api/auth/
  register/route.ts    # POST /api/auth/register
  login/route.ts      # POST /api/auth/login
  me/route.ts         # GET /api/auth/me

app/api/watchlist/
  route.ts             # GET, POST /api/watchlist
  [id]/route.ts       # DELETE /api/watchlist/[id]
  groups/route.ts      # GET, POST /api/watchlist/groups

app/api/portfolio/
  positions/route.ts    # GET, POST /api/portfolio/positions
  [id]/route.ts       # PUT, DELETE /api/portfolio/positions/[id]
  trades/route.ts      # POST /api/portfolio/trades

app/login/page.tsx      # Login page
app/register/page.tsx  # Register page

components/
  UserProvider.tsx      # Auth context (user state)
  AuthButtons.tsx       # Login/Register buttons or user avatar
```

---

## Task 1: Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`
- Create: `lib/password.ts`

**Prerequisites:** Install dependencies:
```bash
npm install prisma @prisma/client bcryptjs jose
npm install -D @types/bcryptjs
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 1: Create prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  watchlists    WatchlistItem[]
  watchlistGroups WatchlistGroup[]
  positions      Position[]
  trades        Trade[]
  chartConfig   ChartConfig?
}

model WatchlistGroup {
  id      String @id @default(cuid())
  userId  String
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  name    String
  order   Int    @default(0)
  items   WatchlistItem[]

  @@index([userId])
}

model WatchlistItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  groupId   String?
  group     WatchlistGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  stockCode String
  addedAt   DateTime @default(now())

  @@index([userId])
  @@index([groupId])
}

model Position {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stockCode String
  shares    Float
  avgCost   Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trades    Trade[]

  @@index([userId])
}

model Trade {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  positionId String
  position   Position @relation(fields: [positionId], references: [id], onDelete: Cascade)
  type      String   // "BUY" or "SELL"
  price     Float
  shares    Float
  tradedAt  DateTime

  @@index([userId])
  @@index([positionId])
}

model ChartConfig {
  id        String  @id @default(cuid())
  userId    String  @unique
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  indicators String  // JSON string of IndicatorConfig
  theme     String  @default("dark")
}
```

- [ ] **Step 2: Update .env**

Add to `.env`:
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
```

- [ ] **Step 3: Create lib/prisma.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Create lib/password.ts**

```typescript
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 5: Generate Prisma client and push schema**

```bash
npx prisma generate
npx prisma db push
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: setup Prisma with SQLite and User model"
```

---

## Task 2: JWT Authentication Utilities

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Create lib/auth.ts**

```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default-secret");

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, createdAt: true },
  });

  return user;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add JWT authentication utilities"
```

---

## Task 3: Auth API Routes

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/me/route.ts`

- [ ] **Step 1: Create app/api/auth/register/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signJWT, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少6位" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });

    const token = await signJWT({ userId: user.id, email: user.email });
    await setAuthCookie(token);

    return NextResponse.json({ user });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create app/api/auth/login/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signJWT, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const token = await signJWT({ userId: user.id, email: user.email });
    await setAuthCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create app/api/auth/me/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user });
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add auth API routes (register, login, me)"
```

---

## Task 4: User Context Provider

**Files:**
- Create: `components/UserProvider.tsx`
- Modify: `components/Header.tsx`

- [ ] **Step 1: Create components/UserProvider.tsx**

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
```

- [ ] **Step 2: Create app/api/auth/logout/route.ts**

```typescript
import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Modify app/layout.tsx to wrap with UserProvider**

Read current layout.tsx first, then update:

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserProvider } from "@/components/UserProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "股票分析",
  description: "个人股票分析工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <UserProvider>{children}</UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add UserProvider and auth context"
```

---

## Task 5: Watchlist API Routes

**Files:**
- Create: `app/api/watchlist/route.ts`
- Create: `app/api/watchlist/[id]/route.ts`
- Create: `app/api/watchlist/groups/route.ts`

- [ ] **Step 1: Create app/api/watchlist/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const items = await prisma.watchlistItem.findMany({
    where: { userId: user.id },
    include: { group: true },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { stockCode, groupId } = await req.json();
  if (!stockCode) {
    return NextResponse.json({ error: "股票代码不能为空" }, { status: 400 });
  }

  // Check if already in watchlist
  const existing = await prisma.watchlistItem.findFirst({
    where: { userId: user.id, stockCode },
  });
  if (existing) {
    return NextResponse.json({ error: "该股票已在自选股中" }, { status: 409 });
  }

  const item = await prisma.watchlistItem.create({
    data: { userId: user.id, stockCode, groupId },
  });

  return NextResponse.json(item);
}
```

- [ ] **Step 2: Create app/api/watchlist/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const item = await prisma.watchlistItem.findFirst({
    where: { id, userId: user.id },
  });
  if (!item) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.watchlistItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create app/api/watchlist/groups/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const groups = await prisma.watchlistGroup.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "分组名称不能为空" }, { status: 400 });

  const maxOrder = await prisma.watchlistGroup.aggregate({
    where: { userId: user.id },
    _max: { order: true },
  });

  const group = await prisma.watchlistGroup.create({
    data: { userId: user.id, name, order: (maxOrder._max.order ?? 0) + 1 },
  });

  return NextResponse.json(group);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add watchlist API routes"
```

---

## Task 6: Portfolio API Routes

**Files:**
- Create: `app/api/portfolio/positions/route.ts`
- Create: `app/api/portfolio/[id]/route.ts`
- Create: `app/api/portfolio/trades/route.ts`

- [ ] **Step 1: Create app/api/portfolio/positions/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const positions = await prisma.position.findMany({
    where: { userId: user.id },
    include: { trades: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(positions);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { stockCode, shares, price, tradedAt } = await req.json();
  if (!stockCode || !shares || !price) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const position = await prisma.position.create({
    data: {
      userId: user.id,
      stockCode,
      shares,
      avgCost: price,
    },
  });

  // Record the BUY trade
  await prisma.trade.create({
    data: {
      userId: user.id,
      positionId: position.id,
      type: "BUY",
      price,
      shares,
      tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
    },
  });

  return NextResponse.json(position);
}
```

- [ ] **Step 2: Create app/api/portfolio/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { shares, avgCost } = await req.json();

  const position = await prisma.position.findFirst({
    where: { id, userId: user.id },
  });
  if (!position) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const updated = await prisma.position.update({
    where: { id },
    data: { shares, avgCost },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const position = await prisma.position.findFirst({
    where: { id, userId: user.id },
  });
  if (!position) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.trade.deleteMany({ where: { positionId: id } });
  await prisma.position.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create app/api/portfolio/trades/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { positionId, type, price, shares, tradedAt } = await req.json();
  if (!positionId || !type || !price || !shares) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const position = await prisma.position.findFirst({
    where: { id: positionId, userId: user.id },
  });
  if (!position) return NextResponse.json({ error: "不存在" }, { status: 404 });

  // Record the trade
  const trade = await prisma.trade.create({
    data: {
      userId: user.id,
      positionId,
      type,
      price,
      shares,
      tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
    },
  });

  // Update position average cost or shares
  if (type === "BUY") {
    const totalCost = position.avgCost * position.shares + price * shares;
    const newShares = position.shares + shares;
    await prisma.position.update({
      where: { id: positionId },
      data: {
        shares: newShares,
        avgCost: totalCost / newShares,
      },
    });
  } else if (type === "SELL") {
    const newShares = position.shares - shares;
    if (newShares < 0) {
      return NextResponse.json({ error: "卖出数量不能超过持仓" }, { status: 400 });
    }
    if (newShares === 0) {
      await prisma.trade.deleteMany({ where: { positionId } });
      await prisma.position.delete({ where: { id: positionId } });
    } else {
      await prisma.position.update({
        where: { id: positionId },
        data: { shares: newShares },
      });
    }
  }

  return NextResponse.json(trade);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add portfolio API routes"
```

---

## Task 7: Login & Register Pages

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/register/page.tsx`
- Create: `components/AuthButtons.tsx`
- Modify: `components/Header.tsx`

- [ ] **Step 1: Create app/login/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md p-8 bg-[var(--surface)] border border-[var(--border)]">
        <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-6">登录</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--accent)]">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[var(--text-muted)]">
          还没有账号？<Link href="/register" className="text-[var(--accent)]">注册</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/register/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }

    if (password.length < 6) {
      setError("密码至少6位");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md p-8 bg-[var(--surface)] border border-[var(--border)]">
        <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-6">注册</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--accent)]">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[var(--text-muted)]">
          已有账号？<Link href="/login" className="text-[var(--accent)]">登录</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create components/AuthButtons.tsx**

```tsx
"use client";

import Link from "next/link";
import { useUser } from "./UserProvider";

export default function AuthButtons() {
  const { user, loading, logout } = useUser();

  if (loading) {
    return (
      <div className="w-8 h-8 bg-[var(--surface-elevated)] border border-[var(--border)] animate-pulse" />
    );
  }

  if (user) {
    return (
      <button
        onClick={logout}
        className="px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
      >
        {user.email}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
      >
        登录
      </Link>
      <Link
        href="/register"
        className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
      >
        注册
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Update components/Header.tsx to use AuthButtons**

Read current Header.tsx, then replace ThemeToggle at the end with AuthButtons:

```tsx
"use client";

import Link from "next/link";
import StockSearch from "./StockSearch";
import AuthButtons from "./AuthButtons";

export default function Header() {
  return (
    <header className="h-14 border-b border-[var(--border)] flex items-center px-4 gap-4 bg-[var(--surface)]">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 bg-[var(--accent)]" />
        <span className="font-display font-semibold text-[var(--text-primary)] tracking-wide">
          股票分析
        </span>
      </Link>
      <div className="flex-1 flex justify-center">
        <StockSearch />
      </div>
      <AuthButtons />
    </header>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add login/register pages and AuthButtons"
```

---

## Task 8: Connect Portfolio Panel with Real Data

**Files:**
- Modify: `components/PortfolioPanel.tsx`

- [ ] **Step 1: Update components/PortfolioPanel.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Link from "next/link";

interface Position {
  id: string;
  stockCode: string;
  shares: number;
  avgCost: number;
}

export default function PortfolioPanel() {
  const { user, loading: userLoading } = useUser();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch("/api/portfolio/positions")
      .then((r) => r.json())
      .then((data) => { setPositions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (userLoading || loading) {
    return (
      <div className="flex-1 p-3">
        <div className="text-xs text-[var(--text-muted)] animate-pulse">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 p-3">
        <div className="text-xs text-[var(--text-muted)] mb-3">持仓记录</div>
        <Link href="/login" className="text-xs text-[var(--accent)] hover:underline">
          登录以查看持仓
        </Link>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex-1 p-3">
        <div className="text-xs text-[var(--text-muted)] mb-3">持仓记录</div>
        <div className="text-xs text-[var(--text-muted)] italic">暂无持仓</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {positions.map((p) => (
        <Link
          key={p.id}
          href={`/stock/${p.stockCode}`}
          className="block px-3 py-2 hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--accent)]">{p.stockCode}</span>
            <span className="text-sm text-[var(--text-primary)]">{p.shares}</span>
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            成本价: ¥{p.avgCost.toFixed(2)}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: connect PortfolioPanel with real data"
```

---

## Task 9: Connect Watchlist Panel with Real Data

**Files:**
- Modify: `components/WatchlistPanel.tsx`

- [ ] **Step 1: Update components/WatchlistPanel.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Link from "next/link";

interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName?: string;
}

export default function WatchlistPanel() {
  const { user, loading: userLoading } = useUser();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWatchlist = () => {
    if (!user) return;
    setLoading(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadWatchlist();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (userLoading || loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-3 py-2 border-b border-[var(--border)] animate-pulse">
            <div className="h-4 bg-[var(--surface-elevated)] rounded w-16 mb-1" />
            <div className="h-3 bg-[var(--surface-elevated)] rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 overflow-y-auto">
        <Link
          href="/login"
          className="block px-3 py-2 text-xs text-[var(--accent)] hover:underline border-b border-[var(--border)]"
        >
          登录以管理自选股
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">暂无自选股</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative px-3 py-2 hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]"
        >
          <Link href={`/stock/${item.stockCode}`} className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--accent)]">{item.stockCode}</span>
            <span className="text-sm text-[var(--text-primary)] truncate ml-2">
              {item.stockName || "未知"}
            </span>
          </Link>
          <button
            onClick={(e) => handleDelete(item.id, e)}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)] text-xs transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: connect WatchlistPanel with real data"
```

---

## Task 10: Build Verification

Run build to ensure everything compiles:

```bash
npm run build
```

If build passes, commit final changes:

```bash
git add -A && git commit -m "feat: complete Phase 2 user system"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Prisma setup with SQLite schema |
| 2 | JWT authentication utilities |
| 3 | Auth API routes (register, login, me) |
| 4 | UserProvider context + logout |
| 5 | Watchlist API routes |
| 6 | Portfolio API routes |
| 7 | Login/Register pages + AuthButtons |
| 8 | Connect PortfolioPanel with real data |
| 9 | Connect WatchlistPanel with real data |
| 10 | Build verification |

**Plan complete.** Saved to `docs/superpowers/plans/2026-03-31-stock-insight-phase2-plan.md`.
