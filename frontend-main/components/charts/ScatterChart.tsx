// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import Tooltip from "../ui/Tooltip";

function ScatterChart({
  data,
  height = 220,
  xKey,
  yKey,
  rKey,
  xLabel,
  yLabel,
  theme = "dark"
}) {
  const [tip, setTip] = useState(null);
  const containerRef = useRef(null);
  const [w, setW] = useState(500);
  useEffect(() => {
    const ob = new ResizeObserver((es) => setW(es[0].contentRect.width));
    if (containerRef.current) ob.observe(containerRef.current);
    return () => ob.disconnect();
  }, []);

  const PAD = { l: 44, r: 16, t: 14, b: 32 };
  const CW = w - PAD.l - PAD.r,
    CH = height - PAD.t - PAD.b;
  const xVals = data.map((d) => d[xKey]),
    yVals = data.map((d) => d[yKey]);
  const maxX = Math.max(...xVals) * 1.1,
    maxY = Math.max(...yVals) * 1.1;
  const maxR = rKey ? Math.max(...data.map((d) => d[rKey])) : 1;
  const px = (v) => PAD.l + (v / maxX) * CW;
  const py = (v) => PAD.t + CH - (v / maxY) * CH;
  const pr = (v) => (rKey ? Math.max(3, (v / maxR) * 14) : 4);

  const xTicks = 5,
    yTicks = 4;
  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onMouseLeave={() => setTip(null)}
    >
      <svg
        width={w}
        height={height}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Grid */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (maxY * i) / yTicks;
          return (
            <g key={i}>
              <line
                x1={PAD.l}
                x2={w - PAD.r}
                y1={py(v)}
                y2={py(v)}
                stroke="var(--chart-grid)"
                strokeWidth="0.3"
              />
              <text
                x={PAD.l - 4}
                y={py(v) + 1}
                textAnchor="end"
                fontSize="10"
                fill={theme === "light" ? "#000000" : "#ffffff"}
                fontFamily="var(--font-mono)"
                dominantBaseline="middle"
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = (maxX * i) / xTicks;
          return (
            <g key={i}>
              <line
                x1={px(v)}
                x2={px(v)}
                y1={PAD.t}
                y2={PAD.t + CH}
                stroke="var(--chart-grid)"
                strokeWidth="0.3"
              />
              <text
                x={px(v)}
                y={PAD.t + CH + 14}
                textAnchor="middle"
                fontSize="10"
                fill={theme === "light" ? "#000000" : "#ffffff"}
                fontFamily="var(--font-mono)"
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
              </text>
            </g>
          );
        })}
        {/* Points */}
        {data.map((d, i) => {
          const col =
            d.published > 10
              ? "var(--suc)"
              : d.published > 0
                ? "var(--warn)"
                : "var(--dan)";
          const r = pr(rKey ? d[rKey] : 1);
          return (
            <circle
              key={i}
              cx={px(d[xKey])}
              cy={py(d[yKey])}
              r={r}
              fill={col}
              fillOpacity="0.72"
              stroke={col}
              strokeWidth="1.2"
              strokeOpacity="0.9"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) =>
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  txt: `${d.user || d.type || d.label}\n${xLabel}: ${d[xKey].toLocaleString()}\n${yLabel}: ${d[yKey].toLocaleString()}${rKey ? `\nPublished: ${d[rKey]}` : ""}`,
                })
              }
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
        {/* Axis labels */}
        <text
          x={PAD.l + CW / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="10"
          fill="var(--chart-tick)"
          fontFamily="var(--font-mono)"
        >
          {xLabel}
        </text>
        <text
          x={10}
          y={PAD.t + CH / 2}
          textAnchor="middle"
          fontSize="10"
          fill="var(--chart-tick)"
          fontFamily="var(--font-mono)"
          transform={`rotate(-90,10,${PAD.t + CH / 2})`}
        >
          {yLabel}
        </text>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export default ScatterChart;
