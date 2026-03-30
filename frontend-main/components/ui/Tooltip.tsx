// @ts-nocheck
import { createPortal } from "react-dom";

function Tooltip({ tip }) {
  if (!tip || typeof document === "undefined") return null;
  const TW = 200, TH = 72;
  const x = Math.min(tip.x + 14, window.innerWidth - TW - 8);
  const y = Math.max(tip.y + 14, 8);
  const yFinal = y + TH > window.innerHeight ? tip.y - TH - 10 : y;
  const lines = tip.txt?.split("\n") || [];

  return createPortal(
    <div style={{
      position: "fixed",
      left: x,
      top: yFinal,
      background: "rgba(10,10,12,0.96)",
      border: "0.5px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 14px",
      pointerEvents: "none",
      zIndex: 9990,
      boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset",
      minWidth: 120,
      maxWidth: 220,
      backdropFilter: "blur(12px)",
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          fontSize: i === 0 ? 13 : 12,
          fontWeight: i === 0 ? 500 : 400,
          color: i === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.48)",
          letterSpacing: i === 0 ? "-0.01em" : "0",
          marginBottom: i === 0 && lines.length > 1 ? 4 : 0,
          lineHeight: 1.4,
        }}>
          {l}
        </div>
      ))}
    </div>,
    document.body
  );
}

export default Tooltip;
