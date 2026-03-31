import type { IChartApi, Time } from "lightweight-charts";

// Convert chart coordinates to pixel position
export function getPixelPosition(
  chart: IChartApi,
  time: Time,
  price: number
): { x: number; y: number } | null {
  const timeScale = chart.timeScale();
  const priceScale = chart.priceScale("");

  const x = timeScale.timeToCoordinate(time);
  const y = priceScale.priceToCoordinate(price);

  if (x === null || y === null) return null;
  return { x, y };
}

// Calculate Fibonacci retracement levels
export function calcFibonacciLevels(
  startPrice: number,
  endPrice: number
): { level: number; price: number; label: string }[] {
  const diff = endPrice - startPrice;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return levels.map((l) => ({
    level: l,
    price: startPrice + diff * l,
    label: l === 0 ? "0%" : l === 1 ? "100%" : `${(l * 100).toFixed(1)}%`,
  }));
}

// Check if user is logged in before drawing operations
export function requireAuth(user: { id: string } | null): void {
  if (!user) throw new Error("未登录");
}
