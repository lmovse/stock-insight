// lib/chartRenderer.ts

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

export const DEFAULT_CONFIG: ChartConfig = {
  background: "#1a1a1a",
  gridColor: "#2a2a2a",
  upColor: "#e53935",
  downColor: "#4caf50",
  maColors: ["#ffffff", "#ffff00", "#cc66ff", "#66ff56", "#cc9966"],
};

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
  private lastMouseX: number = 0;

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
    this.calculateVisibleRange();
    this.render();
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

  private calculateCandleWidth() {
    const baseWidth = 8;
    this.candleWidth = baseWidth * this.scale;
    this.candleGap = Math.max(1, 2 * this.scale);
  }

  private calculateVisibleRange() {
    const totalWidth = this.canvas.width;
    if (totalWidth === 0) return;
    const candleTotal = this.candleWidth + this.candleGap;
    const visibleCount = Math.floor(totalWidth / candleTotal);
    const maxOffset = Math.max(0, this.data.length - visibleCount);
    const offset = Math.max(0, Math.min(maxOffset, this.scrollOffset));
    this.visibleRange = {
      start: offset,
      end: Math.min(this.data.length, offset + visibleCount + 1),
    };
  }

  private render() {
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    if (width === 0 || height === 0) return;
    this.ctx.clearRect(0, 0, width, height);

    // Background
    this.ctx.fillStyle = DEFAULT_CONFIG.background;
    this.ctx.fillRect(0, 0, width, height);

    // Grid
    this.drawGrid();

    if (this.data.length === 0) return;

    // K-lines
    this.drawCandles();

    // MA lines
    this.drawMALines();
  }

  private drawGrid() {
    const { width, height } = this.canvas;
    this.ctx.strokeStyle = DEFAULT_CONFIG.gridColor;
    this.ctx.lineWidth = 0.5;

    // Horizontal grid lines (5 lines)
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  private drawCandles() {
    const { start, end } = this.visibleRange;
    const visibleData = this.data.slice(start, end);
    if (visibleData.length === 0) return;
    const { width, height } = this.canvas;
    const candleTotal = this.candleWidth + this.candleGap;

    // Calculate price range
    let minPrice = Infinity, maxPrice = -Infinity;
    visibleData.forEach((d) => {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    });
    const priceRange = maxPrice - minPrice || 1;
    const priceHeight = height * 0.85;

    visibleData.forEach((d, i) => {
      const x = i * candleTotal + this.candleWidth / 2;
      const isUp = d.close >= d.open;
      const color = isUp ? DEFAULT_CONFIG.upColor : DEFAULT_CONFIG.downColor;

      // Y position
      const yHigh = priceHeight - ((d.high - minPrice) / priceRange) * priceHeight;
      const yLow = priceHeight - ((d.low - minPrice) / priceRange) * priceHeight;
      const yOpen = priceHeight - ((d.open - minPrice) / priceRange) * priceHeight;
      const yClose = priceHeight - ((d.close - minPrice) / priceRange) * priceHeight;

      // Draw wick
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, yHigh);
      this.ctx.lineTo(x, yLow);
      this.ctx.stroke();

      // Draw body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - this.candleWidth / 2, bodyTop, this.candleWidth, bodyHeight);
    });
  }

  private drawMALines() {
    const mas = [5, 10, 20, 30, 60];
    const { start, end } = this.visibleRange;
    const visibleData = this.data.slice(start, end);
    if (visibleData.length === 0) return;
    const { height } = this.canvas;
    const priceHeight = height * 0.85;

    let minPrice = Infinity, maxPrice = -Infinity;
    visibleData.forEach((d) => {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    });
    const priceRange = maxPrice - minPrice || 1;
    const candleTotal = this.candleWidth + this.candleGap;

    mas.forEach((period, idx) => {
      if (visibleData.length < period) return;
      const color = DEFAULT_CONFIG.maColors[idx];

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      let started = false;
      visibleData.forEach((d, i) => {
        if (i < period - 1) return;
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += visibleData[i - j].close;
        }
        const ma = sum / period;
        const x = (i - period + 1) * candleTotal + this.candleWidth / 2;
        const y = priceHeight - ((ma - minPrice) / priceRange) * priceHeight;

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

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.calculateVisibleRange();
    this.render();
  }

  // Get data at pixel position (for crosshair)
  getDataAtX(x: number): KLineData | null {
    const candleTotal = this.candleWidth + this.candleGap;
    const index = Math.floor(x / candleTotal) + this.visibleRange.start;
    if (index < 0 || index >= this.data.length) return null;
    return this.data[index];
  }
}
