// @ts-nocheck
import PublishFunnel from '@/components/charts/Funnel';
import BarRow from '@/components/charts/BarRow';

import { useEffect } from "react";

function Drawer({ open, onClose, channel }) {
  if (!channel) return null;
  const rate = ((channel.published / channel.uploaded) * 100).toFixed(1);
  const multiplier = (channel.created / channel.uploaded).toFixed(1);
  const platList = Object.entries(channel.platforms || {}).filter(
    ([, v]) => v > 0,
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`drawer${open ? " open" : ""}`}>
        <button className="drawer-close" onClick={onClose} title="Close (Esc)">
          ×
        </button>
        <div className="drawer-head">
          <div className="drawer-tag">CHANNEL DEEP-DIVE</div>
          <div className="drawer-title">Channel {channel.ch}</div>
          <div className="drawer-sub">
            Mar 2025 – Feb 2026 · 12-month analysis
          </div>
        </div>
        <div className="drawer-sect">
          <div className="drawer-sect-t">Pipeline</div>
          <PublishFunnel
            uploaded={channel.uploaded}
            created={channel.created}
            published={channel.published}
          />
        </div>
        <div className="drawer-sect">
          <div className="drawer-sect-t">Key Metrics</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 9,
            }}
          >
            {[
              {
                l: "Publish Rate",
                v: `${rate}%`,
                c:
                  parseFloat(rate) > 5
                    ? "var(--green)"
                    : parseFloat(rate) > 1
                      ? "var(--gold)"
                      : "var(--red)",
              },
              {
                l: "AI Multiplier",
                v: `${multiplier}×`,
                c: "var(--pri)",
              },
              { l: "Uploaded", v: channel.uploaded, c: "var(--ink)" },
              { l: "Processed", v: channel.created, c: "var(--ink)" },
            ].map((m) => (
              <div
                key={m.l}
                style={{
                  padding: "9px 11px",
                  border: "1px solid var(--line-lt)",
                  background: "var(--sankey-bg)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink3)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {m.l}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 23,
                    color: m.c,
                  }}
                >
                  {typeof m.v === "number" ? m.v.toLocaleString() : m.v}
                </div>
              </div>
            ))}
          </div>
        </div>
        {platList.length > 0 && (
          <div className="drawer-sect">
            <div className="drawer-sect-t">Platform Distribution</div>
            {platList.map(([plat, cnt]) => (
              <BarRow
                key={plat}
                label={plat}
                value={cnt}
                max={Math.max(...platList.map(([, v]) => v))}
                fillClass="bf-gold"
              />
            ))}
          </div>
        )}
        <div className="drawer-sect">
          <div className="drawer-sect-t">Signal</div>
          {parseFloat(rate) === 0 ? (
            <div className="callout callout-crit">
              <div className="c-tag">⚠ CRITICAL</div>
              <div className="c-text">
                Zero published despite {channel.uploaded} uploads.
              </div>
            </div>
          ) : parseFloat(rate) < 2 ? (
            <div className="callout callout-warn">
              <div className="c-tag">⚡ LOW EFFICIENCY</div>
              <div className="c-text">{rate}% rate below platform avg 2.5%</div>
            </div>
          ) : (
            <div className="callout callout-ok">
              <div className="c-tag">✓ HEALTHY</div>
              <div className="c-text">{rate}% — above platform average</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Drawer;
