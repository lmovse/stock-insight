"use client";

import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, Time } from "lightweight-charts";
import type { DrawingTool } from "./DrawingToolbar";
import { calcFibonacciLevels } from "@/lib/drawings";

interface DrawingData {
  id?: string;
  type: "TREND" | "FIBONACCI" | "HORIZONTAL" | "TEXT";
  data: {
    startTime?: Time;
    startPrice?: number;
    endTime?: Time;
    endPrice?: number;
    time?: Time;
    price?: number;
    text?: string;
  };
  color: string;
}

interface Props {
  chart: IChartApi | null;
  tool: DrawingTool;
  color: string;
  user: { id: string } | null;
  stockCode: string;
  onDrawingComplete: (d: DrawingData) => void;
  drawings: DrawingData[];
}

export default function DrawingCanvas({
  chart,
  tool,
  color,
  user,
  stockCode,
  onDrawingComplete,
  drawings,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<DrawingData | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const chartApi = chart;
    if (!canvas || !chartApi) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing lines
    drawings.forEach((d) => {
      drawOnCanvas(ctx, chartApi, d);
    });

    // Draw current in-progress line
    if (drawingRef.current) {
      drawOnCanvas(ctx, chartApi, drawingRef.current);
    }
  }, [chart, drawings]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (!chart || !canvasRef.current) return;

    const handleResize = () => redraw();
    chart.subscribeResize(handleResize);

    return () => {
      chart.unsubscribeResize(handleResize);
    };
  }, [chart, redraw]);

  function drawOnCanvas(ctx: CanvasRenderingContext2D, chartApi: IChartApi, d: DrawingData) {
    const ts = chartApi.timeScale();

    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.font = "12px JetBrains Mono, monospace";

    if (d.type === "TREND" || d.type === "FIBONACCI") {
      const { startTime, startPrice, endTime, endPrice } = d.data;
      if (!startTime || !endTime || startPrice === undefined || endPrice === undefined) return;

      const x1 = ts.timeToCoordinate(startTime as Time);
      const y1 = chartApi.priceScale("").priceToCoordinate(startPrice);
      const x2 = ts.timeToCoordinate(endTime as Time);
      const y2 = chartApi.priceScale("").priceToCoordinate(endPrice);

      if (x1 === null || x2 === null || y1 === null || y2 === null) return;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (d.type === "FIBONACCI") {
        const levels = calcFibonacciLevels(startPrice, endPrice);
        levels.forEach((l) => {
          const y = chartApi.priceScale("").priceToCoordinate(l.price);
          if (y === null) return;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.strokeStyle = d.color + "80";
          ctx.stroke();
          ctx.fillStyle = d.color;
          ctx.fillText(l.label, x1 + 4, y - 2);
        });
      }

      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(x1, y1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.type === "HORIZONTAL") {
      const { time, price } = d.data;
      if (!time || price === undefined) return;

      const x = ts.timeToCoordinate(time as Time);
      const y = chartApi.priceScale("").priceToCoordinate(price);
      if (x === null || y === null) return;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ts.width(), y);
      ctx.stroke();

      ctx.fillStyle = d.color;
      ctx.fillText(`¥${price.toFixed(2)}`, 4, y - 4);
    } else if (d.type === "TEXT") {
      const { time, price, text } = d.data;
      if (!time || price === undefined || !text) return;

      const x = ts.timeToCoordinate(time as Time);
      const y = chartApi.priceScale("").priceToCoordinate(price);
      if (x === null || y === null) return;

      ctx.fillStyle = d.color;
      ctx.fillText(text, x, y);
    }
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool === "SELECT" || !chart || !user) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ts = chart.timeScale();
      const priceScale = chart.priceScale("");

      const time = ts.coordinateToTime(x);
      const price = priceScale.coordinateToPrice(y);

      if (!time || price === null) return;

      startPosRef.current = { x, y };

      if (tool === "HORIZONTAL" || tool === "TEXT") {
        const text = tool === "TEXT" ? prompt("请输入文字:") || "" : undefined;
        onDrawingComplete({
          type: tool === "HORIZONTAL" ? "HORIZONTAL" : "TEXT",
          data: { time, price, text },
          color,
        });
        startPosRef.current = null;
      } else {
        drawingRef.current = {
          type: tool as "TREND" | "FIBONACCI",
          data: { startTime: time, startPrice: price, endTime: time, endPrice: price },
          color,
        };
        redraw();
      }
    },
    [tool, chart, user, color, onDrawingComplete, redraw]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || !chart) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ts = chart.timeScale();
      const priceScale = chart.priceScale("");

      const time = ts.coordinateToTime(x);
      const price = priceScale.coordinateToPrice(y);

      if (!time || price === null) return;

      drawingRef.current = {
        ...drawingRef.current,
        data: {
          ...drawingRef.current.data,
          endTime: time,
          endPrice: price,
        },
      };

      redraw();
    },
    [chart, redraw]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || !chart) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ts = chart.timeScale();
      const priceScale = chart.priceScale("");

      const time = ts.coordinateToTime(x);
      const price = priceScale.coordinateToPrice(y);

      if (!time || price === null) return;

      drawingRef.current = {
        ...drawingRef.current,
        data: {
          ...drawingRef.current.data,
          endTime: time,
          endPrice: price,
        },
      };

      const startX = ts.timeToCoordinate(drawingRef.current.data.startTime as Time);
      const startY = priceScale.priceToCoordinate(drawingRef.current.data.startPrice ?? 0);
      if (startX !== null && startY !== null) {
        const dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        if (dist < 10) {
          drawingRef.current = null;
          startPosRef.current = null;
          redraw();
          return;
        }
      }

      onDrawingComplete(drawingRef.current);
      drawingRef.current = null;
      startPosRef.current = null;
      redraw();
    },
    [chart, onDrawingComplete, redraw]
  );

  if (!chart) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "auto",
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
}
