// @ts-nocheck
import { useState, useRef, useEffect } from "react";

/* Premium colour ramp — red-anchor, alpha stepped by rank */
const PALETTE = [
  "rgba(232,67,45,0.92)",
  "rgba(218,58,40,0.82)",
  "rgba(200,52,36,0.72)",
  "rgba(185,47,32,0.64)",
  "rgba(168,44,30,0.57)",
  "rgba(148,40,27,0.52)",
  "rgba(128,36,24,0.47)",
  "rgba(108,32,21,0.44)",
  "rgba(88,28,18,0.40)",
  "rgba(68,24,16,0.38)",
];

function Treemap({ data, height = 340, onSelect }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: height });

  useEffect(() => {
    const ob = new ResizeObserver((es) =>
      setDims({ w: es[0].contentRect.width, h: height })
    );
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, [height]);

  /* Only positive-value items enter the layout.
     Zero/negative items cause blank gaps because they consume
     0 pixels while still advancing the loop cursor. */
  const activeData = data.filter((d) => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  /* Squarified treemap layout.
     KEY FIX: strip proportions are computed against `remTotal`
     (the rolling sum of *remaining* items) not the global total.
     This guarantees the layout always fills 100% of the rect. */
  function layout(items, x, y, w, h) {
    if (!items.length || w < 1 || h < 1) return [];
    const sorted = [...items]
      .map((d, i) => ({ ...d, origIdx: i }))
      .sort((a, b) => b.value - a.value);

    const result = [];
    let rem = [...sorted];
    let rx = x, ry = y, rw = w, rh = h;

    while (rem.length > 0) {
      const remTotal = rem.reduce((s, d) => s + d.value, 0);
      if (remTotal <= 0 || rw < 1 || rh < 1) break;

      const isH = rw >= rh;
      let best = 1;

      for (let n = 1; n <= rem.length; n++) {
        const sl = rem.slice(0, n);
        const sT = sl.reduce((s, d) => s + d.value, 0);
        const sP = sT / remTotal;           // ← fraction of REMAINING area
        const dim = isH ? rw * sP : rh * sP;
        let mAR = 0;
        sl.forEach((it) => {
          const p = it.value / sT;
          const cw = isH ? dim   : rw * p;
          const ch = isH ? rh * p : dim;
          if (cw > 0 && ch > 0)
            mAR = Math.max(mAR, Math.max(cw / ch, ch / cw));
        });
        if (n === 1 || mAR < 3) best = n;
        else break;
      }

      const sl = rem.slice(0, best);
      const sT = sl.reduce((s, d) => s + d.value, 0);
      const sP = sT / remTotal;
      const sD = isH ? rw * sP : rh * sP;

      let cx2 = rx, cy2 = ry;
      sl.forEach((it) => {
        const p = it.value / sT;
        const cw = isH ? sD   : rw * p;
        const ch = isH ? rh * p : sD;
        result.push({ ...it, x: cx2, y: cy2, w: cw, h: ch });
        if (isH) cy2 += ch; else cx2 += cw;
      });

      if (isH) { rx += sD; rw -= sD; }
      else     { ry += sD; rh -= sD; }
      rem = rem.slice(best);
    }
    return result;
  }

  const GAP = 3;
  /* Rank colours use the full dataset ordering (including zero-value entries) */
  const ranked  = [...data].sort((a, b) => b.value - a.value);
  const rankMap = new Map(ranked.map((d, i) => [d.label, i]));
  const cells   = layout(activeData, 0, 0, dims.w, height);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Treemap canvas ── */}
      <div ref={ref} style={{ height, width: "100%", position: "relative" }}>
        {cells.map((c, i) => {
          const rank  = rankMap.get(c.label) ?? i;
          const color = PALETTE[Math.min(rank, PALETTE.length - 1)];
          const pct   = total > 0 ? (c.value / total) * 100 : 0;
          const isHov = hoveredIdx === i;
          const isDim = hoveredIdx !== null && !isHov;
          const cw = Math.max(0, c.w - GAP * 2);
          const ch = Math.max(0, c.h - GAP * 2);
          const showLabel = ch > 34 && cw > 64;
          const showValue = ch > 54 && cw > 52;
          const showPct   = ch > 72 && cw > 72;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c.x + GAP, top: c.y + GAP,
                width: cw, height: ch,
                background: color,
                cursor: "pointer",
                borderRadius: 7,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                padding: 10,
                opacity: isDim ? 0.20 : 1,
                transform: isHov ? "scale(1.018)" : "scale(1)",
                zIndex: isHov ? 5 : 1,
                transition: "opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease",
                boxShadow: isHov
                  ? "0 10px 40px rgba(0,0,0,0.60), inset 0 0 0 1.5px rgba(255,255,255,0.28)"
                  : "inset 0 0 0 0.5px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.25)",
              }}
              onClick={() => onSelect && onSelect(c)}
              onMouseEnter={(e) => {
                setHoveredIdx(i);
                setTipPos({ x: e.clientX, y: e.clientY, c, pct });
              }}
              onMouseMove={(e) =>
                setTipPos((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
              }
              onMouseLeave={() => { setHoveredIdx(null); setTipPos(null); }}
            >
              {/* Gradient vignette */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.28) 100%)",
              }} />

              {/* Rank badge */}
              {showLabel && (
                <div style={{
                  position: "absolute", top: 9, left: 11,
                  fontSize: 9, fontFamily: "-apple-system,'SF Pro Text',sans-serif",
                  color: "rgba(255,255,255,0.38)", fontWeight: 500,
                  letterSpacing: "0.08em", pointerEvents: "none",
                }}>
                  #{rank + 1}
                </div>
              )}

              {/* Label */}
              {showLabel && (
                <span style={{
                  fontSize: Math.min(14, Math.max(10, Math.sqrt(cw * ch) / 9)),
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.95)",
                  textAlign: "center",
                  lineHeight: 1.25,
                  pointerEvents: "none",
                  letterSpacing: "-0.01em",
                  fontFamily: "-apple-system,'SF Pro Text',sans-serif",
                  zIndex: 1,
                  maxWidth: "88%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {c.label}
                </span>
              )}

              {/* Value */}
              {showValue && (
                <span style={{
                  fontSize: Math.min(12, Math.max(10, cw / 16)),
                  color: "rgba(255,255,255,0.60)",
                  pointerEvents: "none",
                  marginTop: 4,
                  fontFamily: "-apple-system,'SF Pro Text',sans-serif",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                  zIndex: 1,
                }}>
                  {c.value.toLocaleString()}
                </span>
              )}

              {/* % pill */}
              {showPct && (
                <span style={{
                  fontSize: 9.5,
                  color: "rgba(255,255,255,0.55)",
                  pointerEvents: "none",
                  marginTop: 6,
                  background: "rgba(0,0,0,0.28)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontFamily: "-apple-system,'SF Pro Text',sans-serif",
                  fontVariantNumeric: "tabular-nums",
                  zIndex: 1,
                  letterSpacing: "0.02em",
                }}>
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}

        {/* Floating tooltip */}
        {tipPos && typeof window !== "undefined" && (() => {
          const TW = 185, TH = 70;
          const tx = Math.min(tipPos.x + 16, window.innerWidth - TW - 8);
          const ty = tipPos.y + 16 + TH > window.innerHeight
            ? tipPos.y - TH - 12
            : tipPos.y + 16;
          return (
            <div style={{
              position: "fixed", left: tx, top: ty,
              background: "rgba(8,8,10,0.97)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 9, padding: "11px 15px",
              pointerEvents: "none", zIndex: 9990,
              boxShadow: "0 10px 40px rgba(0,0,0,0.60)",
              minWidth: 140,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.92)", fontFamily: "-apple-system,'SF Pro Text',sans-serif", letterSpacing: "-0.01em", marginBottom: 5 }}>
                {tipPos.c.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.70)", fontFamily: "-apple-system,'SF Pro Text',sans-serif", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                  {tipPos.c.value.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: "rgba(232,100,80,0.85)", fontFamily: "-apple-system,'SF Pro Text',sans-serif" }}>
                  {tipPos.pct.toFixed(1)}%
                </span>
              </div>
              {tipPos.c.note && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontFamily: "-apple-system,'SF Pro Text',sans-serif", marginTop: 4 }}>
                  {tipPos.c.note}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Ranked legend footer ── */}
      <div style={{
        background: "rgba(255,255,255,0.022)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: 9,
        padding: "12px 16px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 24px",
      }}>
        {ranked.map((d, rank) => {
          const pct     = total > 0 ? (d.value / total * 100).toFixed(1) : "0";
          const color   = PALETTE[Math.min(rank, PALETTE.length - 1)];
          const cellIdx = cells.findIndex((c) => c.label === d.label);
          const isHov   = hoveredIdx === cellIdx;
          return (
            <div
              key={d.label}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                opacity: hoveredIdx === null || isHov ? 1 : 0.30,
                transition: "opacity 0.20s ease",
                cursor: cellIdx >= 0 ? "default" : "default",
              }}
              onMouseEnter={() => cellIdx >= 0 && setHoveredIdx(cellIdx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0,
                opacity: d.value <= 0 ? 0.35 : 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", fontFamily: "-apple-system,'SF Pro Text',sans-serif", letterSpacing: "0.01em" }}>
                #{rank + 1}
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", fontFamily: "-apple-system,'SF Pro Text',sans-serif" }}>
                {d.label}
              </span>
              <span style={{ fontSize: 12, color: d.value > 0 ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.32)", fontWeight: 500, fontFamily: "-apple-system,'SF Pro Text',sans-serif", fontVariantNumeric: "tabular-nums" }}>
                {d.value.toLocaleString()}
              </span>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", fontFamily: "-apple-system,'SF Pro Text',sans-serif" }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Treemap;
