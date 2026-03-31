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