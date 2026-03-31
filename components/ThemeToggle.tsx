'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      // 自动 - 显示器图标
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    }
    return resolvedTheme === 'dark' ? (
      // 深色 - 月亮
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ) : (
      // 亮色 - 太阳
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    );
  };

  return (
    <button
      onClick={cycleTheme}
      className="group flex items-center gap-2 px-3 py-1 bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-all"
      title={theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色模式' : '浅色模式'}
    >
      <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
        {getIcon()}
      </span>
      <span className="text-xs font-mono text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors uppercase tracking-wide">
        {theme === 'system' ? 'AUTO' : theme === 'dark' ? 'DARK' : 'LIGHT'}
      </span>
    </button>
  );
}
