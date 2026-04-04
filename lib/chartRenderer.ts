import { calcMA, calcMACD, calcKDJ, calcBOLL, calcRSI } from "./indicators";

export interface KLineData {
  date: number;      // yyyymmdd format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

export interface ChartConfig {
  background: string;
  gridColor: string;
  upColor: string;     // #e53935
  downColor: string;   // #4caf50
  maColors: string[];  // [MA5, MA10, MA20, MA30, MA60]
}

export interface IndicatorSettings {
  ma: boolean;
  maPeriods: number[];
  macd: boolean;
  kdj: boolean;
  boll: boolean;
  rsi: boolean;
}

export const DEFAULT_CONFIG: ChartConfig = {
  background: "#1a1a1a",
  gridColor: "#2a2a2a",
  upColor: "#e53935",
  downColor: "#4caf50",
  maColors: ["#ffffff", "#ffff00", "#cc66ff", "#66ff56", "#cc9966"],
};

export const LIGHT_CONFIG: ChartConfig = {
  background: "#f7f8fa",
  gridColor: "#e8e8ec",
  upColor: "#e53935",
  downColor: "#10b981",
  maColors: ["#333333", "#d4a017", "#9333ea", "#22c55e", "#c2410c"],
};

// Layout ratios
const MAIN_CHART_RATIO = 0.55;
const VOLUME_RATIO = 0.12;
const MACD_RATIO = 0.15;
const KDJ_RATIO = 0.09;
const RSI_RATIO = 0.09;
const BASE_PADDING_LEFT = 40;
const BASE_PADDING_RIGHT = 50;
const MOBILE_BREAKPOINT = 480;
const MOBILE_PADDING_LEFT = 5;
const MOBILE_PADDING_RIGHT = 10;

export class ChartRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: KLineData[] = [];
  private visibleRange: { start: number; end: number } = { start: 0, end: 100 };
  private candleWidth: number = 8;
  private candleGap: number = 2;
  private scale: number = 1;
  private scrollOffset: number = 0;
  private isDragging: boolean = false;
  private isTouchDragging: boolean = false;
  private isPinching: boolean = false;
  private lastMouseX: number = 0;
  private lastTouchX: number = 0;
  private lastPinchDistance: number = 0;
  private cssWidth: number = 0;
  private cssHeight: number = 0;
  private crosshairX: number | null = null;
  private crosshairY: number | null = null;
  private config: ChartConfig = { ...DEFAULT_CONFIG };
  private settings: IndicatorSettings = {
    ma: true,
    maPeriods: [5, 10, 20, 60],
    macd: true,
    kdj: false,
    boll: false,
    rsi: false,
  };

  // Cached calculations
  private maCache: Map<number, (number | null)[]> = new Map();
  private macdCache: { dif: number[]; dea: number[]; macd: number[] } | null = null;
  private kdjCache: { k: number[]; d: number[]; j: number[] } | null = null;
  private bollCache: { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } | null = null;
  private rsiCache: (number | null)[] = [];

  // Responsive padding
  private get paddingLeft() {
    return this.cssWidth < MOBILE_BREAKPOINT ? MOBILE_PADDING_LEFT : BASE_PADDING_LEFT;
  }
  private get paddingRight() {
    return this.cssWidth < MOBILE_BREAKPOINT ? MOBILE_PADDING_RIGHT : BASE_PADDING_RIGHT;
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;
    this.canvas.style.cursor = "crosshair";
    this.bindEvents();
  }

  private bindEvents() {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this), { passive: false });
    this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));
  }

  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      this.isPinching = true;
      this.isTouchDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDistance = Math.hypot(dx, dy);
      return;
    }
    if (e.touches.length === 1) {
      this.isTouchDragging = true;
      this.lastTouchX = e.touches[0].clientX;
    }
  }

  private handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && this.isPinching) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const delta = (distance - this.lastPinchDistance) * 0.01;
      this.setScale(this.scale + delta);
      this.lastPinchDistance = distance;
      return;
    }
    if (!this.isTouchDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - this.lastTouchX;
    const candleTotal = this.candleWidth + this.candleGap;
    const offsetDelta = Math.round(dx / candleTotal);
    if (offsetDelta !== 0) {
      this.setScrollOffset(this.scrollOffset - offsetDelta);
      this.lastTouchX = e.touches[0].clientX;
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) {
      this.isPinching = false;
    }
    if (e.touches.length === 0) {
      this.isTouchDragging = false;
    }
    if (e.touches.length === 1) {
      this.isTouchDragging = true;
      this.lastTouchX = e.touches[0].clientX;
    }
  }

  private handleMouseDown(e: MouseEvent) {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.canvas.style.cursor = "grabbing";
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const candleTotal = this.candleWidth + this.candleGap;
      const offsetDelta = Math.round(dx / candleTotal);
      if (offsetDelta !== 0) {
        this.setScrollOffset(this.scrollOffset - offsetDelta);
        this.lastMouseX = e.clientX;
      }
    }
  }

  private handleMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = "crosshair";
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.setScale(this.scale + delta);
  }

  setData(data: KLineData[]) {
    this.data = data;
    this.invalidateCache();
    this.calculateVisibleRange();
    this.render();
  }

  setSettings(settings: Partial<IndicatorSettings>) {
    this.settings = { ...this.settings, ...settings };
    this.invalidateCache();
    this.render();
  }

  setTheme(theme: "dark" | "light") {
    this.config = theme === "light" ? { ...LIGHT_CONFIG } : { ...DEFAULT_CONFIG };
    this.render();
  }

  setCrosshair(x: number | null, y: number | null) {
    this.crosshairX = x;
    this.crosshairY = y;
    this.render();
  }

  private invalidateCache() {
    this.maCache.clear();
    this.macdCache = null;
    this.kdjCache = null;
    this.bollCache = null;
    this.rsiCache = [];
  }

  private getMA(period: number): (number | null)[] {
    if (!this.maCache.has(period)) {
      this.maCache.set(period, calcMA(this.data, period));
    }
    return this.maCache.get(period)!;
  }

  private getMACD() {
    if (!this.macdCache) {
      this.macdCache = calcMACD(this.data);
    }
    return this.macdCache;
  }

  private getKDJ() {
    if (!this.kdjCache) {
      this.kdjCache = calcKDJ(this.data);
    }
    return this.kdjCache;
  }

  private getBOLL() {
    if (!this.bollCache) {
      this.bollCache = calcBOLL(this.data);
    }
    return this.bollCache;
  }

  private getRSI() {
    if (this.rsiCache.length === 0) {
      this.rsiCache = calcRSI(this.data);
    }
    return this.rsiCache;
  }

  setScale(scale: number) {
    this.scale = Math.max(0.5, Math.min(3, scale));
    this.calculateCandleWidth();
    this.calculateVisibleRange();
    this.render();
  }

  setScrollOffset(offset: number) {
    this.scrollOffset = offset;
    this.calculateVisibleRange();
    this.render();
  }

  resetScroll() {
    // Scroll to end (most recent data) instead of beginning
    const totalWidth = this.cssWidth - this.paddingRight;
    if (totalWidth <= 0 || this.data.length === 0) return;
    const candleTotal = this.candleWidth + this.candleGap;
    // Use ceil so the last candle body is fully within the chart area
    const visibleCount = Math.ceil((totalWidth - this.paddingLeft) / candleTotal);
    this.scrollOffset = Math.max(0, this.data.length - visibleCount);
    this.calculateVisibleRange();
    this.render();
  }

  private calculateCandleWidth() {
    const baseWidth = 8;
    this.candleWidth = baseWidth * this.scale;
    this.candleGap = Math.max(1, 2 * this.scale);
  }

  private calculateVisibleRange() {
    const totalWidth = this.cssWidth - this.paddingRight;
    if (totalWidth <= 0) return;
    const candleTotal = this.candleWidth + this.candleGap;
    // Use ceil so the last candle body is fully visible (not cut off by clip)
    // Subtract 1 because candle center at this.paddingLeft + (visibleCount-1)*candleTotal
    // must have its right edge <= chartRight
    const visibleCount = Math.ceil((totalWidth - this.paddingLeft) / candleTotal);
    const maxOffset = Math.max(0, this.data.length - visibleCount);
    const offset = Math.max(0, Math.min(maxOffset, this.scrollOffset));
    this.visibleRange = {
      start: offset,
      end: Math.min(this.data.length, offset + visibleCount),
    };
  }

  private getDrawingAreas(): { main: { y: number; h: number }; volume: { y: number; h: number }; macd: { y: number; h: number }; kdj: { y: number; h: number }; rsi: { y: number; h: number } } {
    const height = this.cssHeight;
    const topPadding = 0;
    const main = { y: topPadding, h: Math.floor(height * MAIN_CHART_RATIO) - topPadding };
    const volume = { y: main.y + main.h, h: Math.floor(height * VOLUME_RATIO) };
    const macd = { y: volume.y + volume.h, h: Math.floor(height * MACD_RATIO) };
    const kdj = { y: macd.y + macd.h, h: Math.floor(height * KDJ_RATIO) };
    const rsiY = kdj.y + kdj.h;
    const rsi = { y: rsiY, h: height - rsiY };
    return { main, volume, macd, kdj, rsi };
  }

  private render() {
    if (!this.ctx) return;
    const width = this.cssWidth;
    const height = this.cssHeight;
    if (width === 0 || height === 0) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    this.ctx.fillStyle = this.config.background;
    this.ctx.fillRect(0, 0, width, height);

    if (this.data.length === 0) return;

    // Clip all chart content to the area before Y axis labels
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.cssWidth - this.paddingRight, this.cssHeight);
    this.ctx.clip();

    const areas = this.getDrawingAreas();
    const { start, end } = this.visibleRange;
    const visibleData = this.data.slice(start, end);
    const candleTotal = this.candleWidth + this.candleGap;

    // Draw grid for each area
    this.drawGrid(areas.main.y, areas.main.h);
    if (this.settings.ma || this.settings.boll) {
      this.drawGrid(areas.volume.y, areas.volume.h);
    }
    if (this.settings.macd) {
      this.drawGrid(areas.macd.y, areas.macd.h);
    }
    if (this.settings.kdj) {
      this.drawGrid(areas.kdj.y, areas.kdj.h);
    }
    if (this.settings.rsi) {
      this.drawGrid(areas.rsi.y, areas.rsi.h);
    }

    // Calculate price range for main chart with padding
    let minPrice = Infinity, maxPrice = -Infinity;
    visibleData.forEach((d) => {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    });
    // Add 5% padding to price range to avoid candles touching edges
    const pricePadding = (maxPrice - minPrice) * 0.05;
    minPrice = minPrice - pricePadding;
    maxPrice = maxPrice + pricePadding;

    // Draw main chart elements
    this.drawCandles(visibleData, start, candleTotal, minPrice, maxPrice, areas.main.y, areas.main.h);

    if (this.settings.ma) {
      this.drawMALines(visibleData, start, candleTotal, minPrice, maxPrice, areas.main.y, areas.main.h);
    }

    if (this.settings.boll) {
      this.drawBOLL(visibleData, start, candleTotal, minPrice, maxPrice, areas.main.y, areas.main.h);
    }

    // Draw volume
    this.drawVolume(visibleData, start, candleTotal, areas.volume.y, areas.volume.h);

    // Draw MACD
    if (this.settings.macd) {
      this.drawMACD(start, candleTotal, areas.macd.y, areas.macd.h);
    }

    // Draw KDJ
    if (this.settings.kdj) {
      this.drawKDJ(start, candleTotal, areas.kdj.y, areas.kdj.h);
    }

    // Draw RSI
    if (this.settings.rsi) {
      this.drawRSI(start, candleTotal, areas.rsi.y, areas.rsi.h);
    }

    // End chart area clip — axes and crosshair draw beyond it
    this.ctx.restore();

    // Draw axes
    this.drawPriceAxis(minPrice, maxPrice, areas.main.y, areas.main.h);
    this.drawTimeAxis(visibleData, start, candleTotal);

    // Draw separator lines
    this.drawSeparator(areas.volume.y - 1);
    if (this.settings.macd) this.drawSeparator(areas.macd.y - 1);
    if (this.settings.kdj) this.drawSeparator(areas.kdj.y - 1);

    // Draw crosshair
    if (this.crosshairX !== null) {
      this.drawCrosshair(areas);
    }
  }

  private drawGrid(y: number, h: number) {
    const width = this.cssWidth - this.paddingRight;
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 0.5;

    for (let i = 0; i <= 4; i++) {
      const yPos = y + (h / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddingLeft, yPos);
      this.ctx.lineTo(width, yPos);
      this.ctx.stroke();
    }
  }

  private drawSeparator(y: number) {
    const width = this.cssWidth - this.paddingRight;
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.paddingLeft, y);
    this.ctx.lineTo(width, y);
    this.ctx.stroke();
  }

  private drawCandles(visibleData: KLineData[], start: number, candleTotal: number, minPrice: number, maxPrice: number, areaY: number, areaH: number) {
    const priceRange = maxPrice - minPrice || 1;

    visibleData.forEach((d, i) => {
      const x = this.paddingLeft + i * candleTotal + this.candleWidth / 2;

      const isUp = d.close >= d.open;
      const color = isUp ? this.config.upColor : this.config.downColor;

      const yHigh = areaY + areaH - ((d.high - minPrice) / priceRange) * areaH;
      const yLow = areaY + areaH - ((d.low - minPrice) / priceRange) * areaH;
      const yOpen = areaY + areaH - ((d.open - minPrice) / priceRange) * areaH;
      const yClose = areaY + areaH - ((d.close - minPrice) / priceRange) * areaH;

      // Wick
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, yHigh);
      this.ctx.lineTo(x, yLow);
      this.ctx.stroke();

      // Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - this.candleWidth / 2, bodyTop, this.candleWidth, bodyHeight);
    });
  }

  private drawMALines(visibleData: KLineData[], start: number, candleTotal: number, minPrice: number, maxPrice: number, areaY: number, areaH: number) {
    const priceRange = maxPrice - minPrice || 1;

    this.settings.maPeriods.forEach((period, idx) => {
      if (idx >= this.config.maColors.length) return;
      const maData = this.getMA(period);
      const color = this.config.maColors[idx];

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      let started = false;
      visibleData.forEach((d, i) => {
        const dataIndex = start + i;
        if (dataIndex < period - 1) return;
        const ma = maData[dataIndex];
        if (ma === null) return;

        const x = this.paddingLeft + i * candleTotal + this.candleWidth / 2;
        const y = areaY + areaH - ((ma - minPrice) / priceRange) * areaH;

        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      });

      this.ctx.stroke();
    });
  }

  private drawBOLL(visibleData: KLineData[], start: number, candleTotal: number, minPrice: number, maxPrice: number, areaY: number, areaH: number) {
    const boll = this.getBOLL();
    const priceRange = maxPrice - minPrice || 1;

    // Draw upper and lower bands
    const drawLine = (data: (number | null)[]) => {
      this.ctx.beginPath();
      let started = false;
      visibleData.forEach((d, i) => {
        const dataIndex = start + i;
        const value = data[dataIndex];
        if (value === null) return;

        const x = this.paddingLeft + i * candleTotal + this.candleWidth / 2;
        const y = areaY + areaH - ((value - minPrice) / priceRange) * areaH;

        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      });
      this.ctx.stroke();
    };

    // Upper band - purple
    this.ctx.strokeStyle = "#cc66ff";
    this.ctx.lineWidth = 1;
    drawLine(boll.upper);

    // Lower band - purple
    drawLine(boll.lower);

    // Middle band - dashed yellow
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeStyle = "#ffff00";
    drawLine(boll.middle);
    this.ctx.setLineDash([]);
  }

  private drawVolume(visibleData: KLineData[], start: number, candleTotal: number, areaY: number, areaH: number) {
    // Find max volume in visible range
    let maxVolume = 0;
    visibleData.forEach((d) => {
      maxVolume = Math.max(maxVolume, d.volume);
    });
    if (maxVolume === 0) maxVolume = 1;

    visibleData.forEach((d, i) => {
      const x = this.paddingLeft + i * candleTotal;
      const isUp = d.close >= d.open;
      const color = isUp ? this.config.upColor : this.config.downColor;
      const barHeight = (d.volume / maxVolume) * areaH * 0.9;

      this.ctx.fillStyle = color + "80"; // Semi-transparent
      this.ctx.fillRect(x, areaY + areaH - barHeight, this.candleWidth, barHeight);
    });
  }

  private drawMACD(start: number, candleTotal: number, areaY: number, areaH: number) {
    const macd = this.getMACD();
    const visibleEnd = this.visibleRange.end;

    // Find max/min for scaling
    let maxVal = 0, minVal = 0;
    for (let i = start; i < visibleEnd; i++) {
      maxVal = Math.max(maxVal, macd.dif[i], macd.dea[i], macd.macd[i]);
      minVal = Math.min(minVal, macd.dif[i], macd.dea[i], macd.macd[i]);
    }
    const range = maxVal - minVal || 1;
    const midY = areaY + areaH / 2;

    // Draw DIF (white) and DEA (yellow)
    this.ctx.lineWidth = 1;

    // DIF
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.beginPath();
    let started = false;
    for (let i = start; i < visibleEnd; i++) {
      const x = this.paddingLeft + (i - start) * candleTotal + this.candleWidth / 2;
      const y = midY - ((macd.dif[i] - (maxVal + minVal) / 2) / range) * (areaH / 2);
      if (!started) { this.ctx.moveTo(x, y); started = true; }
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // DEA
    this.ctx.strokeStyle = "#ffff00";
    this.ctx.beginPath();
    started = false;
    for (let i = start; i < visibleEnd; i++) {
      const x = this.paddingLeft + (i - start) * candleTotal + this.candleWidth / 2;
      const y = midY - ((macd.dea[i] - (maxVal + minVal) / 2) / range) * (areaH / 2);
      if (!started) { this.ctx.moveTo(x, y); started = true; }
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // MACD histogram
    for (let i = start; i < visibleEnd; i++) {
      const x = this.paddingLeft + (i - start) * candleTotal;
      const macdVal = macd.macd[i];
      const y = midY - ((macdVal - (maxVal + minVal) / 2) / range) * (areaH / 2);
      const barHeight = Math.abs(macdVal / range) * (areaH / 2);
      const barY = macdVal >= 0 ? y : midY;

      this.ctx.fillStyle = macdVal >= 0 ? "#e5393580" : "#4caf5080";
      this.ctx.fillRect(x, barY, this.candleWidth, barHeight);
    }

    // Label - inside chart area on the right
    this.ctx.fillStyle = "#888888";
    this.ctx.font = "10px JetBrains Mono, monospace";
    this.ctx.textAlign = "right";
    this.ctx.fillText("MACD", this.cssWidth - this.paddingRight - 5, areaY + 12);
    this.ctx.textAlign = "start";
  }

  private drawKDJ(start: number, candleTotal: number, areaY: number, areaH: number) {
    const kdj = this.getKDJ();
    const visibleEnd = this.visibleRange.end;

    this.ctx.lineWidth = 1;

    // K line - white
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.beginPath();
    let started = false;
    for (let i = start; i < visibleEnd; i++) {
      const x = this.paddingLeft + (i - start) * candleTotal + this.candleWidth / 2;
      const y = areaY + areaH - (kdj.k[i] / 100) * areaH;
      if (!started) { this.ctx.moveTo(x, y); started = true; }
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // D line - yellow
    this.ctx.strokeStyle = "#ffff00";
    this.ctx.beginPath();
    started = false;
    for (let i = start; i < visibleEnd; i++) {
      const x = this.paddingLeft + (i - start) * candleTotal + this.candleWidth / 2;
      const y = areaY + areaH - (kdj.d[i] / 100) * areaH;
      if (!started) { this.ctx.moveTo(x, y); started = true; }
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // J line - purple
    this.ctx.strokeStyle = "#cc66ff";
    this.ctx.beginPath();
    started = false;
    for (let i = start; i < visibleEnd; i++) {
      const x = this.paddingLeft + (i - start) * candleTotal + this.candleWidth / 2;
      const y = areaY + areaH - (kdj.j[i] / 100) * areaH;
      if (!started) { this.ctx.moveTo(x, y); started = true; }
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Label - inside chart area on the right
    this.ctx.fillStyle = "#888888";
    this.ctx.font = "10px JetBrains Mono, monospace";
    this.ctx.textAlign = "right";
    this.ctx.fillText("KDJ", this.cssWidth - this.paddingRight - 5, areaY + 12);
    this.ctx.textAlign = "start";
  }

  private drawRSI(start: number, candleTotal: number, areaY: number, areaH: number) {
    const rsi = this.getRSI();
    const visibleEnd = this.visibleRange.end;

    this.ctx.strokeStyle = "#cc66ff";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    let started = false;
    for (let i = start; i < visibleEnd; i++) {
      const value = rsi[i];
      if (value === null) continue;
      const x = this.paddingLeft + (i - start) * candleTotal + this.candleWidth / 2;
      const y = areaY + areaH - (value / 100) * areaH;
      if (!started) { this.ctx.moveTo(x, y); started = true; }
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Overbought/oversold lines
    this.ctx.strokeStyle = "#4a4a4a";
    this.ctx.setLineDash([4, 4]);
    // 70 line
    this.ctx.beginPath();
    this.ctx.moveTo(this.paddingLeft, areaY + areaH * 0.3);
    this.ctx.lineTo(this.cssWidth - this.paddingRight, areaY + areaH * 0.3);
    this.ctx.stroke();
    // 30 line
    this.ctx.beginPath();
    this.ctx.moveTo(this.paddingLeft, areaY + areaH * 0.7);
    this.ctx.lineTo(this.cssWidth - this.paddingRight, areaY + areaH * 0.7);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Label
    this.ctx.fillStyle = "#888888";
    this.ctx.font = "10px JetBrains Mono, monospace";
    this.ctx.textAlign = "right";
    this.ctx.fillText("RSI", this.cssWidth - this.paddingRight - 5, areaY + 12);
    this.ctx.textAlign = "start";
  }

  private drawPriceAxis(minPrice: number, maxPrice: number, areaY: number, areaH: number) {
    // Draw Y axis labels floating inside the chart area
    const labelX = this.cssWidth - this.paddingRight - 5;
    this.ctx.fillStyle = "#888888";
    this.ctx.font = "10px JetBrains Mono, monospace";
    this.ctx.textAlign = "right";

    const step = (maxPrice - minPrice) / 4;
    for (let i = 0; i <= 4; i++) {
      const price = maxPrice - step * i;
      const y = areaY + (areaH / 4) * i + 10;
      this.ctx.fillText(price.toFixed(2), labelX, y);
    }

    this.ctx.textAlign = "start";
  }

  private drawTimeAxis(visibleData: KLineData[], start: number, candleTotal: number) {
    if (visibleData.length === 0) return;

    const y = this.cssHeight - 5;
    this.ctx.fillStyle = "#888888";
    this.ctx.font = "10px JetBrains Mono, monospace";
    this.ctx.textAlign = "center";

    // Show fewer labels on mobile to avoid overlapping
    const labelCount = this.cssWidth < MOBILE_BREAKPOINT ? 4 : 6;
    const interval = Math.max(1, Math.floor(visibleData.length / labelCount));
    visibleData.forEach((d, i) => {
      if (i % interval !== 0) return;
      const x = this.paddingLeft + i * candleTotal + this.candleWidth / 2;
      const dateStr = String(d.date);
      const label = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
      this.ctx.fillText(label, x, y);
    });

    this.ctx.textAlign = "start";
  }

  private drawCrosshair(areas: ReturnType<typeof this.getDrawingAreas>) {
    const { main } = areas;
    const chartRight = this.cssWidth - this.paddingRight;

    this.ctx.save();

    // Snap to nearest candle center
    const candleTotal = this.candleWidth + this.candleGap;
    const candleIndex = Math.floor((this.crosshairX! - this.paddingLeft) / candleTotal);
    const snapX = this.paddingLeft + candleIndex * candleTotal + candleTotal / 2;

    // Vertical line — dashed, spans the entire chart height, snapped to candle center
    this.ctx.strokeStyle = "rgba(150, 150, 150, 0.8)";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(snapX, 0);
    this.ctx.lineTo(snapX, this.cssHeight);
    this.ctx.stroke();

    // Horizontal line — dashed, spans the price chart area
    if (this.crosshairY !== null) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddingLeft, this.crosshairY!);
      this.ctx.lineTo(chartRight, this.crosshairY!);
      this.ctx.stroke();

      // Price label on Y axis - floating inside chart
      const priceRange = this.getMainPriceRange();
      if (priceRange) {
        const { minPrice, maxPrice } = priceRange;
        const areaH = main.h;
        const areaY = main.y;
        const price = maxPrice - ((this.crosshairY! - areaY) / areaH) * (maxPrice - minPrice);
        const labelX = chartRight - 5;
        this.ctx.fillStyle = "rgba(30, 30, 30, 0.85)";
        this.ctx.fillRect(labelX - 60, this.crosshairY! - 8, 65, 16);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "10px JetBrains Mono, monospace";
        this.ctx.textAlign = "right";
        this.ctx.fillText(price.toFixed(2), labelX, this.crosshairY! + 3);
        this.ctx.textAlign = "start";
      }
    }

    this.ctx.restore();
  }

  private getMainPriceRange(): { minPrice: number; maxPrice: number } | null {
    const { start, end } = this.visibleRange;
    if (this.data.length === 0 || start >= end) return null;
    const visibleData = this.data.slice(start, end);
    let minPrice = Infinity, maxPrice = -Infinity;
    visibleData.forEach((d) => {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    });
    return { minPrice, maxPrice };
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    this.calculateVisibleRange();
    this.render();
  }

  getDataAtX(x: number): KLineData | null {
    if (x < this.paddingLeft || x >= this.cssWidth - this.paddingRight) return null;
    const candleTotal = this.candleWidth + this.candleGap;
    const index = Math.floor((x - this.paddingLeft) / candleTotal) + this.visibleRange.start;
    if (index < 0 || index >= this.data.length) return null;
    return this.data[index];
  }

  getIndicatorValuesAt(index: number) {
    const result: Record<string, number | null> = {};

    if (this.settings.ma) {
      this.settings.maPeriods.forEach((period) => {
        const ma = this.getMA(period);
        result[`MA${period}`] = ma[index];
      });
    }

    if (this.settings.macd) {
      const macd = this.getMACD();
      result["DIF"] = macd.dif[index];
      result["DEA"] = macd.dea[index];
      result["MACD"] = macd.macd[index];
    }

    if (this.settings.kdj) {
      const kdj = this.getKDJ();
      result["K"] = kdj.k[index];
      result["D"] = kdj.d[index];
      result["J"] = kdj.j[index];
    }

    if (this.settings.rsi) {
      const rsi = this.getRSI();
      result["RSI"] = rsi[index];
    }

    if (this.settings.boll) {
      const boll = this.getBOLL();
      result["BOLL-U"] = boll.upper[index];
      result["BOLL-M"] = boll.middle[index];
      result["BOLL-L"] = boll.lower[index];
    }

    return result;
  }
}
