"use client";

import Link from "next/link";
import { useUser } from "./UserProvider";

export default function AuthButtons() {
  const { user, loading, logout } = useUser();

  if (loading) {
    return <div className="w-16 h-8 rounded-lg bg-[var(--surface-hover)] animate-pulse" />;
  }

  if (user) {
    return (
      <button
        onClick={logout}
        className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--surface-raised)] rounded-lg transition-all border border-[var(--border)]"
      >
        {user.email.split('@')[0]}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/login"
        className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--surface-raised)] rounded-lg transition-all border border-[var(--border)]"
      >
        登录
      </Link>
      <Link
        href="/register"
        className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg transition-all border border-transparent"
        style={{ background: 'var(--accent)' }}
      >
        注册
      </Link>
    </div>
  );
}
