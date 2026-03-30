// @ts-nocheck
import Tooltip from '@/components/ui/Tooltip';
import { useState } from "react";

function DonutChart({ segments, size = 180, label, sub }) {
  const [tip, setTip] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const cx = size / 2, cy = size / 2;
  const r = (size - 28) / 2;
  const ir = r * 0.60;
  const total = segments.reduce((a, b) => a + b.value, 0);
  let angle = -Math.PI / 2;
  const paths = segments.map((s, idx) => {
    const sa = angle, sw = (s.value / total) * Math.PI * 2;
    angle += sw;
    const expand = hoveredIdx === idx ? 4 : 0;
    const rr = r + expand, irr = ir;
    const x1 = cx + rr * Math.cos(sa), y1 = cy + rr * Math.sin(sa);
    const x2 = cx + rr * Math.cos(sa + sw), y2 = cy + rr * Math.sin(sa + sw);
    const ix1 = cx + irr * Math.cos(sa), iy1 = cy + irr * Math.sin(sa);
    const ix2 = cx + irr * Math.cos(sa + sw), iy2 = cy + irr * Math.sin(sa + sw);
    const large = sw > Math.PI ? 1 : 0;
    return {
      ...s, idx,
      d: `M${ix1},${iy1} L${x1},${y1} A${rr},${rr} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${irr},${irr} 0 ${large},0 ${ix1},${iy1} Z`,
    };
  });

  const hovered = hoveredIdx !== null ? segments[hoveredIdx] : null;
  const displayLabel = hovered ? hovered.value.toLocaleString() : label;
  const displaySub = hovered ? `${((hovered.value / total) * 100).toFixed(1)}%` : sub;

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
        {paths.map((p) => (
          <path
            key={p.idx}
            d={p.d}
            fill={p.color}
            opacity={hoveredIdx === null ? 0.88 : hoveredIdx === p.idx ? 1 : 0.45}
            style={{ cursor: "pointer", transition: "opacity 0.18s ease, d 0.18s ease" }}
            onMouseEnter={(e) => {
              setHoveredIdx(p.idx);
              setTip({ x: e.clientX, y: e.clientY, txt: `${p.label}\n${p.value.toLocaleString()} · ${((p.value / total) * 100).toFixed(1)}%` });
            }}
            onMouseMove={(e) => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
            onMouseLeave={() => { setHoveredIdx(null); setTip(null); }}
          />
        ))}
        <circle cx={cx} cy={cy} r={ir - 2} fill="var(--bg2)" />
        {displayLabel && (
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size > 150 ? "16" : "13"}
            fill={hovered ? hovered.color : "rgba(255,255,255,0.88)"}
            fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
            fontWeight="500" style={{ transition: "fill 0.18s ease" }}>
            {displayLabel}
          </text>
        )}
        {displaySub && (
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={size > 150 ? "11" : "9"}
            fill="rgba(255,255,255,0.35)"
            fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif">
            {displaySub}
          </text>
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export default DonutChart;
