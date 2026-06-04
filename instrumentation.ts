const ts = () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = (...args: unknown[]) => origLog(`[${ts()}]`, ...args);
console.warn = (...args: unknown[]) => origWarn(`[${ts()}]`, ...args);
console.error = (...args: unknown[]) => origError(`[${ts()}]`, ...args);

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/tushare/scheduler');
  }
}
