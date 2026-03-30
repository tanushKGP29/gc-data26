// @ts-nocheck
import { useState } from "react";

import Tooltip from "../ui/Tooltip";

function LineChart({ data, keys, colors, height = 185, showArea = false, theme = "dark" }) {
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState(null);
  const W = 100,
    H = height,
    PAD = { l: 40, r: 12, t: 12, b: 26 };
  const CW = W - PAD.l - PAD.r,
    CH = H - PAD.t - PAD.b;
  const allVals = data.flatMap((d) => keys.map((k) => d[k] || 0));
  const maxV = Math.max(...allVals) * 1.1 || 1;
  const n = data.length;
  const x = (i) => PAD.l + (i / (n - 1)) * CW;
  const y = (v) => PAD.t + CH - (v / maxV) * CH;
  const lp = (k) =>
    data
      .map(
        (d, i) =>
          `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k] || 0).toFixed(1)}`,
      )
      .join(" ");
  const ap = (k) =>
    `${lp(k)} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const ticks = 5;
  const yT = Array.from({ length: ticks + 1 }, (_, i) =>
    Math.round((maxV * i) / ticks),
  );
  return (
    <div
      style={{ position: "relative", width: "100%" }}
      onMouseLeave={() => {
        setHover(null);
        setTip(null);
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%",
          height: H,
          display: "block",
          overflow: "visible",
        }}
        preserveAspectRatio="none"
      >
        <defs>
          {keys.map((k, ki) => (
            <linearGradient key={k} id={`ag-${ki}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[ki]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={colors[ki]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {yT.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--chart-grid)"
              strokeWidth="0.3"
            />
            <text
              x={PAD.l - 3}
              y={y(v) + 1}
              textAnchor="end"
              fontSize="3.6"
              fill={theme === "light" ? "#000000" : "#ffffff"}
              fontFamily="var(--font-mono)"
            >
              {v === 0 ? "0" : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          </g>
        ))}
        {data.map(
          (d, i) =>
            i % Math.ceil(n / 6) === 0 && (
              <text
                key={i}
                x={x(i)}
                y={H - PAD.b + 6}
                textAnchor="middle"
                fontSize="3.2"
                fill={theme === "light" ? "#000000" : "#ffffff"}
                fontFamily="var(--font-mono)"
              >
                {d.month}
              </text>
            ),
        )}
        {showArea &&
          keys.map((k, ki) => (
            <path key={`a${k}`} d={ap(k)} fill={`url(#ag-${ki})`} />
          ))}
        {keys.map((k, ki) => (
          <path
            key={k}
            d={lp(k)}
            fill="none"
            stroke={colors[ki]}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {keys.map((k, ki) =>
          data.map((d, i) => (
            <circle
              key={`${k}${i}`}
              cx={x(i)}
              cy={y(d[k] || 0)}
              r={hover === i ? 2.2 : 1.1}
              fill={colors[ki]}
              stroke={hover === i ? "rgba(255,255,255,0.8)" : "none"}
              strokeWidth="0.3"
              style={{ cursor: "pointer", transition: "r 0.1s" }}
              onMouseEnter={(e) => {
                setHover(i);
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  txt: `${d.month}\n${k}: ${(d[k] || 0).toLocaleString()}`,
                });
              }}
            />
          )),
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="rgba(212,149,42,0.45)"
            strokeWidth="0.3"
            strokeDasharray="2,2"
          />
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export default LineChart;
