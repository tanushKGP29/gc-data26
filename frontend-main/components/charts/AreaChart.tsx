// @ts-nocheck
import { useState } from "react";
import Tooltip from "../ui/Tooltip";

function AreaChart({
  data,
  key1,
  key2,
  color1,
  color2,
  height = 160,
  label1,
  label2,
  theme = "dark"
}) {
  const [tip, setTip] = useState(null);
  const W = 100,
    H = height,
    PAD = { l: 36, r: 10, t: 10, b: 22 };
  const CW = W - PAD.l - PAD.r,
    CH = H - PAD.t - PAD.b;
  const maxV =
    Math.max(...data.map((d) => Math.max(d[key1] || 0, d[key2] || 0))) * 1.15 ||
    1;
  const n = data.length,
    x = (i) => PAD.l + (i / (n - 1)) * CW,
    y = (v) => PAD.t + CH - (v / maxV) * CH;
  const lp = (k) =>
    data
      .map(
        (d, i) =>
          `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k] || 0).toFixed(1)}`,
      )
      .join(" ");
  const ap = (k) =>
    `${lp(k)} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  return (
    <div
      style={{ position: "relative", width: "100%" }}
      onMouseLeave={() => setTip(null)}
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
          <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color1} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="a2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color2} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color2} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <line
            key={i}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + CH * (1 - v)}
            y2={PAD.t + CH * (1 - v)}
            stroke="var(--chart-grid)"
            strokeWidth="0.4"
          />
        ))}
        <path d={ap(key1)} fill="url(#a1)" />
        <path d={ap(key2)} fill="url(#a2)" />
        <path
          d={lp(key1)}
          fill="none"
          stroke={color1}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d={lp(key2)}
          fill="none"
          stroke={color2}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="2,1.5"
        />
        {data.map(
          (d, i) =>
            i % Math.ceil(n / 6) === 0 && (
              <text
                key={i}
                x={x(i)}
                y={H - PAD.b + 5}
                textAnchor="middle"
                fontSize="2.8"
                fill={theme === "light" ? "#000000" : "#ffffff"}
              >
                {d.month}
              </text>
            ),
        )}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d[key1] || 0)}
            r="0.9"
            fill={color1}
            onMouseEnter={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                txt: `${d.month}\n${label1}: ${(d[key1] || 0).toFixed(1)}h\n${label2}: ${(d[key2] || 0).toFixed(1)}h`,
              })
            }
            onMouseLeave={() => setTip(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export default AreaChart;
