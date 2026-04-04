"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/components/UserProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { user, refresh } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; invitationCode?: string; global?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!email) errs.email = "请输入邮箱";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "邮箱格式不正确";
    if (!password) errs.password = "请输入密码";
    else if (password.length < 6) errs.password = "密码至少6位";
    if (!confirmPassword) errs.confirmPassword = "请确认密码";
    else if (password !== confirmPassword) errs.confirmPassword = "两次密码不一致";
    if (!invitationCode) errs.invitationCode = "请输入邀请码";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, invitationCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrors({ global: data.error || "注册失败" });
        return;
      }

      await refresh();
      router.push("/");
    } catch {
      setErrors({ global: "网络错误" });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (field: keyof typeof errors) =>
    `w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--surface-solid)] border text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${errors[field] ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`;

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--background)] animate-page-enter">
      <div className="glass-card rounded-2xl w-full max-w-[95vw] sm:max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-6">注册</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              placeholder="输入邮箱地址"
              className={fieldClass("email")}
            />
            {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
              placeholder="至少6位密码"
              className={fieldClass("password")}
            />
            {errors.password && <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>{errors.password}</p>}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
              placeholder="再次输入密码"
              className={fieldClass("confirmPassword")}
            />
            {errors.confirmPassword && <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>{errors.confirmPassword}</p>}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">邀请码</label>
            <input
              type="text"
              value={invitationCode}
              onChange={(e) => { setInvitationCode(e.target.value); setErrors((p) => ({ ...p, invitationCode: undefined })); }}
              placeholder="输入邀请码"
              className={fieldClass("invitationCode")}
            />
            {errors.invitationCode && <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>{errors.invitationCode}</p>}
          </div>

          {errors.global && (
            <div className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--up-bg)', color: 'var(--up-color)' }}>{errors.global}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold pill-active disabled:opacity-50"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[var(--text-muted)]">
          已有账号？<Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">登录</Link>
        </div>
      </div>
    </div>
  );
}
