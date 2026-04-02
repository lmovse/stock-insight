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
    <div className="h-screen flex items-center justify-center bg-[var(--background)] animate-page-enter">
      <div className="glass-card rounded-2xl w-full max-w-[95vw] sm:max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-6">登录</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入邮箱地址"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold pill-active disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[var(--text-muted)]">
          还没有账号？<Link href="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">注册</Link>
        </div>
      </div>
    </div>
  );
}