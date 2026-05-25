"use client";

import { useEffect, useRef } from "react";

export type GraphSpec = {
  functions: string[];
  xRange: [number, number];
  yRange: [number, number];
  points?: Array<{ x: number; y: number; label: string }>;
  vAsymptotes?: number[];
  hAsymptotes?: number[];
};

export function parseGraphSpec(block: string): GraphSpec | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const getAll = (key: string) =>
    lines
      .filter((l) => l.toLowerCase().startsWith(key.toLowerCase() + ":"))
      .map((l) => l.slice(key.length + 1).trim());
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = getAll(k)[0];
      if (v) return v;
    }
    return null;
  };

  const fnLines = getAll("fn");
  const functions = fnLines
    .map((expr) =>
      expr
        .replace(/^[fg]?\(x\)\s*=\s*/i, "")  // strip "f(x) =" prefix
        .replace(/\^/g, "**")                  // ^ → **
        .trim()
    )
    .filter(Boolean);

  if (functions.length === 0) return null;

  const parseRange = (s: string | null): [number, number] => {
    if (!s) return [-10, 10];
    const m = s.match(/([-\d.]+)\s*(?:to|,)\s*([-\d.]+)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [-10, 10];
  };

  const xRange = parseRange(get("xRange", "xrange"));
  const yRange = parseRange(get("yRange", "yrange"));

  const pointsStr = get("points");
  const points: Array<{ x: number; y: number; label: string }> = [];
  if (pointsStr) {
    const ptRx = /([A-Z]'?)\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = ptRx.exec(pointsStr)) !== null) {
      points.push({ label: m[1], x: parseFloat(m[2]), y: parseFloat(m[3]) });
    }
  }

  const parseNums = (s: string | null) =>
    s ? Array.from(s.matchAll(/([-\d.]+)/g), (m) => parseFloat(m[1])) : [];

  const vAsymptotes = parseNums(get("vAsymptote", "vasymptote", "vAsymptotes"));
  const hAsymptotes = parseNums(get("hAsymptote", "hasymptote", "hAsymptotes"));

  return { functions, xRange, yRange, points, vAsymptotes, hAsymptotes };
}

export function FunctionGraph({ spec }: { spec: GraphSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    import("function-plot").then(({ default: functionPlot }) => {
      if (cancelled || !el) return;
      el.innerHTML = "";

      // Build data series — split at vertical asymptotes to avoid connecting lines across them
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = [];
      for (const fn of spec.functions) {
        if (spec.vAsymptotes && spec.vAsymptotes.length > 0) {
          const sorted = [...spec.vAsymptotes].sort((a, b) => a - b);
          let start = spec.xRange[0];
          for (const vx of sorted) {
            data.push({ fn, range: [start, vx - 0.02], nSamples: 200, graphType: "polyline" });
            start = vx + 0.02;
          }
          data.push({ fn, range: [start, spec.xRange[1]], nSamples: 200, graphType: "polyline" });
        } else {
          data.push({ fn, nSamples: 300, graphType: "polyline" });
        }
      }

      // Labeled points as scatter series
      if (spec.points && spec.points.length > 0) {
        data.push({
          points: spec.points.map((p) => [p.x, p.y]),
          fnType: "points",
          graphType: "scatter",
        });
      }

      const annotations = [
        ...(spec.vAsymptotes?.map((x) => ({ x, text: `x = ${x}` })) ?? []),
        ...(spec.hAsymptotes?.map((y) => ({ y, text: `y = ${y}` })) ?? []),
      ];

      try {
        functionPlot({
          target: el,
          width: el.clientWidth || 480,
          height: 320,
          xAxis: { domain: spec.xRange },
          yAxis: { domain: spec.yRange },
          grid: true,
          data,
          annotations,
          tip: { xLine: true, yLine: true },
        });
      } catch (e) {
        console.warn("function-plot render error:", e);
      }
    });

    return () => {
      cancelled = true;
    };
  // specKey is a stable JSON string — safe dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  return (
    <div
      ref={ref}
      className="my-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white"
      style={{ minHeight: 320 }}
      aria-label="Function graph"
    />
  );
}

export function FigureCallout({ description }: { description: string }) {
  return (
    <div className="my-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Diagram</p>
      <p className="text-sm leading-relaxed text-[var(--foreground)]">{description}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Refer to the official PDF for the exact figure.
      </p>
    </div>
  );
}
