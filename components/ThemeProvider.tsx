'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Read initial theme before hydration to prevent flash
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as Theme) || 'system';
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [hydrated, setHydrated] = useState(false);
  const resolvedTheme = resolveTheme(theme);

  // Read theme from localStorage only after hydration to avoid mismatch
  useEffect(() => {
    setThemeState(getInitialTheme());
    setHydrated(true);
  }, []);

  // Set data-theme attribute - only after hydration to avoid overriding blocking script
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const listener = () => {
      if (theme === 'system') {
        document.documentElement.setAttribute('data-theme', resolveTheme('system'));
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme, hydrated]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', resolveTheme(newTheme));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
