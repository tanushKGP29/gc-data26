// @ts-nocheck
import { useState } from "react";
import Tooltip from "../ui/Tooltip";

function RadarChart({ data, size = 280 }) {
  const [tip, setTip] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const padding = 58;
  const cx = size / 2, cy = size / 2;
  const r = (size - padding * 2) / 2;
  const n = data.length;
  const angle = (i) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (i, pct) => ({
    x: cx + r * pct * Math.cos(angle(i)),
    y: cy + r * pct * Math.sin(angle(i)),
  });
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible", maxWidth: size }}
      >
        {/* Ring grid */}
        {rings.map((rv) => (
          <polygon
            key={rv}
            points={Array.from({ length: n }, (_, i) => `${pt(i, rv).x},${pt(i, rv).y}`).join(" ")}
            fill={rv === 1 ? "rgba(232,71,87,0.04)" : "none"}
            stroke={rv === 1 ? "rgba(232,71,87,0.20)" : "rgba(255,255,255,0.06)"}
            strokeWidth={rv === 1 ? 1 : 0.7}
          />
        ))}
        {/* Spokes */}
        {Array.from({ length: n }, (_, i) => (
          <line key={i} x1={cx} y1={cy} x2={pt(i, 1).x} y2={pt(i, 1).y}
            stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        ))}
        {/* Ring value labels */}
        {[0.5, 1.0].map((rv) => (
          <text key={rv} x={cx + 4} y={cy - r * rv - 4}
            fontSize="9" fill="rgba(255,255,255,0.25)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif">
            {Math.round(maxVal * rv).toLocaleString()}
          </text>
        ))}
        {/* Data polygon */}
        <polygon
          points={data.map((d, i) => { const pct = d.value / maxVal; return `${pt(i, pct).x},${pt(i, pct).y}`; }).join(" ")}
          fill="rgba(232,71,87,0.13)"
          stroke="rgba(232,71,87,0.85)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Data points + axis labels */}
        {data.map((d, i) => {
          const pct = d.value / maxVal;
          const p = pt(i, pct);
          const lp = pt(i, 1.30);
          const anchor = lp.x < cx - 8 ? "end" : lp.x > cx + 8 ? "start" : "middle";
          const isHov = hoveredIdx === i;
          return (
            <g key={i}>
              {/* Hover hit area */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => { setHoveredIdx(i); setTip({ x: e.clientX, y: e.clientY, txt: `${d.label}\n${d.value.toLocaleString()}` }); }}
                onMouseMove={(e) => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
                onMouseLeave={() => { setHoveredIdx(null); setTip(null); }}
              />
              {/* Data dot */}
              <circle cx={p.x} cy={p.y} r={isHov ? 6 : 4}
                fill={isHov ? "#e84757" : "rgba(232,71,87,0.90)"}
                stroke={isHov ? "rgba(255,255,255,0.50)" : "#0e0f11"}
                strokeWidth={isHov ? 1.5 : 1.5}
                style={{ transition: "r 0.15s ease", cursor: "pointer", pointerEvents: "none" }}
              />
              {/* Axis label */}
              <text x={lp.x} y={lp.y + 4} textAnchor={anchor}
                fontSize="11.5" fill={isHov ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.60)"}
                fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                dominantBaseline="middle"
                style={{ transition: "fill 0.15s ease" }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ width: "100%", marginTop: 14, display: "flex", flexWrap: "wrap", gap: "6px 18px", justifyContent: "center" }}>
        {data.map((d, i) => (
          <div key={d.label} style={{
            display: "flex", alignItems: "center", gap: 6,
            opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.35,
            transition: "opacity 0.15s ease",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,71,87,0.90)", flexShrink: 0 }} />
            <span style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              fontSize: 11.5, color: "rgba(255,255,255,0.50)",
            }}>
              {d.label}:{" "}
              <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 500 }}>
                {d.value.toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

export default RadarChart;
