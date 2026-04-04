"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "./UserProvider";

export default function AuthButtons() {
  const router = useRouter();
  const { user, loading, logout } = useUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <div className="w-16 h-8 rounded-lg bg-[var(--surface-hover)] animate-pulse" />;
  }

  if (user) {
    return (
      <div className="relative hidden md:block" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--surface-raised)] rounded-lg transition-all border border-[var(--border)]"
        >
          {user.email.split('@')[0]}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-36 rounded-lg border border-[var(--border)] shadow-lg z-50 overflow-hidden"
            style={{ background: 'var(--surface-solid)' }}>
            <button
              onClick={async () => {
                setDropdownOpen(false);
                await logout();
                router.push("/login");
              }}
              className="w-full px-4 py-2.5 text-sm text-left text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
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
