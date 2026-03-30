// @ts-nocheck
import useChartJs from '@/components/charts/ChartJSWrapper';
import useJsonData from '@/hooks/useJsonData';
import { useState, useRef, useEffect } from "react";
import D3SankeyChart from "../charts/D3SankeyChart";
import PublishFunnel from "../charts/Funnel";
import BarRow from "../charts/BarRow";
import Treemap from "../charts/Treemap";
import GraphActionButtons from "../ui/GraphActionButtons";
import GraphFlip from "../ui/GraphFlip";
import GraphInsights from "../ui/GraphInsights";
import SectionInfoHint from '@/components/ui/SectionInfoHint';
import { useDash } from '@/lib/contexts';
import { useLiveSectionData } from '@/hooks/useDashboardData';
import { M } from '@/lib/constants';

/* ─────────────────────────────────────────────────────────────
   By Channel — premium redesign
───────────────────────────────────────────────────────────── */
function ByChannelTab({ channels }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [fTip, setFTip] = useState(null);
  const gaugeArcRef = useRef(null);
  const gaugeGlowRef = useRef(null);
  const funnelContainerRef = useRef(null);

  const ch = channels[selectedIdx] || channels[0];
  if (!ch) return null;

  const pubRate = (ch.published / ch.uploaded) * 100;
  const isGreen = pubRate >= 5;
  const TC = isGreen ? "#3EC98A" : "#ff4757";
  const aiMult = ch.created / ch.uploaded;
  const aiExpPct = Math.round((aiMult - 1) * 100);
  const pubDropPct = ch.created > 0 ? (1 - ch.published / ch.created) * 100 : 0;
  const CIRC = 2 * Math.PI * 54;

  // Gauge animation
  useEffect(() => {
    if (!gaugeArcRef.current || !gaugeGlowRef.current) return;
    const pct = Math.min(pubRate / 100, 1);
    const target = CIRC * (1 - pct);
    gaugeArcRef.current.style.transition = "none";
    gaugeArcRef.current.style.strokeDashoffset = CIRC;
    gaugeGlowRef.current.style.transition = "none";
    gaugeGlowRef.current.style.strokeDashoffset = CIRC;
    const t = setTimeout(() => {
      if (!gaugeArcRef.current || !gaugeGlowRef.current) return;
      gaugeArcRef.current.style.transition = "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)";
      gaugeArcRef.current.style.strokeDashoffset = target;
      gaugeGlowRef.current.style.transition = "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)";
      gaugeGlowRef.current.style.strokeDashoffset = target;
    }, 60);
    return () => clearTimeout(t);
  }, [animKey, selectedIdx]);

  const handleSelect = (idx) => {
    if (idx === selectedIdx) return;
    setSelectedIdx(idx);
    setAnimKey((k) => k + 1);
    setFTip(null);
  };

  // Funnel geometry
  const crH = 74, CY = 105;
  const upH = Math.max(14, (ch.uploaded / ch.created) * 74);
  const puH = ch.published > 0 ? Math.max(5, (ch.published / ch.created) * 74) : 4;

  const getTipData = (seg) => {
    const estH = (ch.uploaded * 0.18).toFixed(1);
    if (seg === "upload") return {
      title: "UPLOADED", color: "rgba(255,255,255,0.7)",
      rows: [
        { label: "Total Files", value: ch.uploaded.toLocaleString(), unit: "raw files" },
        { label: "Pipeline Role", value: "100%", unit: "entry point" },
        { label: "AI Multiplier", value: `×${aiMult.toFixed(1)}`, unit: "expansion rate" },
        { label: "Est. Hours", value: estH, unit: "processing hrs" },
      ],
    };
    if (seg === "create") return {
      title: "AI CREATED", color: "#ff6b7a",
      rows: [
        { label: "AI Outputs", value: ch.created.toLocaleString(), unit: "generated files" },
        { label: "Expansion", value: `+${aiExpPct}%`, unit: "from uploaded" },
        { label: "Net Added", value: (ch.created - ch.uploaded).toLocaleString(), unit: "new pieces" },
        { label: "Filtered Out", value: (ch.created - ch.published).toLocaleString(), unit: "unpublished" },
      ],
    };
    return {
      title: "PUBLISHED", color: TC,
      rows: [
        { label: "Live Items", value: ch.published.toLocaleString(), unit: "active content" },
        { label: "Pub Rate", value: `${pubRate.toFixed(1)}%`, unit: "of created" },
        { label: "End-to-End", value: `${((ch.published / ch.uploaded) * 100).toFixed(1)}%`, unit: "of uploaded" },
        { label: "Health", value: isGreen ? "Healthy" : "Critical", unit: isGreen ? "✓ above 5%" : "✗ below 5%" },
      ],
    };
  };

  const handleFunnelEnter = (e, seg) => {
    const rect = funnelContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setFTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, seg });
  };
  const handleFunnelMove = (e) => {
    const rect = funnelContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setFTip((t) => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : t);
  };

  const F = "var(--font-dm-sans,'DM Sans',Inter,sans-serif)";
  const M = "var(--font-jetbrains-mono,'JetBrains Mono','IBM Plex Mono',monospace)";

  return (
    <>
      <style>{`
        @keyframes bch-glide {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* ── Channel selector pills ── */
        .bch-pill {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          display: flex; flex-direction: column;
          align-items: flex-start; justify-content: space-between;
          gap: 0; padding: 11px 12px 9px;
          cursor: pointer; min-height: 76px;
          position: relative; overflow: hidden;
          transition: border-color .18s, background .18s, box-shadow .18s, transform .18s;
        }
        .bch-pill:hover {
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.13);
          transform: translateY(-1px);
        }
        .bch-pill.bch-active {
          border-color: rgba(255,71,87,.55);
          background: rgba(255,71,87,.06);
          box-shadow: 0 0 0 1px rgba(255,71,87,.18), 0 6px 24px rgba(255,71,87,.12);
        }
        .bch-pill.bch-active::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 2px; background: linear-gradient(90deg, transparent, rgba(255,71,87,.7), transparent);
        }
        /* ── Glass cards ── */
        .bch-glass {
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px; backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          position: relative; overflow: hidden;
          transition: border-color .18s, box-shadow .18s;
        }
        .bch-glass:hover { border-color: rgba(255,255,255,.12); }
        .bch-glass::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 1px; pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent);
        }
        /* ── Metric cards ── */
        .bch-metric {
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px; backdrop-filter: blur(20px);
          padding: 20px 18px; position: relative; overflow: hidden;
          transition: border-color .18s, box-shadow .18s, transform .18s;
          cursor: default;
        }
        .bch-metric:hover {
          border-color: rgba(255,71,87,.30);
          box-shadow: 0 4px 24px rgba(255,71,87,.08);
          transform: translateY(-2px);
        }
        .bch-metric::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 1px; pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent);
        }
        /* ── Conversion cards ── */
        .bch-conv {
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px; padding: 20px 18px;
          text-align: center; position: relative; overflow: hidden;
          transition: border-color .18s, box-shadow .18s, transform .18s;
          cursor: default;
        }
        .bch-conv:hover {
          border-color: rgba(255,255,255,.14);
          transform: translateY(-1px);
        }
        /* ── Funnel wrapper ── */
        .bch-funnel-wrap {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 14px;
          position: relative; overflow: visible;
          transition: border-color .18s;
        }
        .bch-funnel-wrap:hover { border-color: rgba(255,255,255,.11); }
        .bch-funnel-wrap::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0;
          height: 1px; pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent);
        }
      `}</style>

      {/* ── Channel Selector Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 8, marginBottom: 18 }}>
        {channels.map((c, i) => {
          const r = (c.published / c.uploaded) * 100;
          const tc = r >= 5 ? "#3EC98A" : r >= 1 ? "#f59e0b" : "#ff4757";
          const barW = Math.min(r / 10 * 100, 100); // 10% pub rate = full bar
          const isActive = i === selectedIdx;
          return (
            <div key={c.ch} className={`bch-pill${isActive ? " bch-active" : ""}`} onClick={() => handleSelect(i)}>
              {/* Top row: label + rate */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%", marginBottom: 6 }}>
                <span style={{ fontFamily: M, fontSize: 13, fontWeight: 700, color: isActive ? "#fff" : "rgba(255,255,255,0.82)", lineHeight: 1 }}>
                  Ch-{c.ch}
                </span>
                <span style={{ fontFamily: M, fontSize: 10.5, fontWeight: 600, color: tc, lineHeight: 1 }}>
                  {r.toFixed(1)}%
                </span>
              </div>
              {/* Uploaded count */}
              <span style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1, marginBottom: 8 }}>
                {c.uploaded.toLocaleString()}
              </span>
              {/* Publish rate bar */}
              <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${barW}%`, minWidth: barW > 0 ? 2 : 0, height: "100%", background: tc, borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail View ── */}
      <div key={animKey} style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, animation: "bch-glide 0.35s ease both" }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Card 1 — Identity */}
          <div className="bch-glass" style={{ padding: "22px 20px" }}>
            <div style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
              CHANNEL IDENTIFIER
            </div>
            <div style={{
              fontFamily: M, fontSize: 64, fontWeight: 700, lineHeight: 1, marginBottom: 8,
              background: "linear-gradient(135deg,#ff6b7a,#ff4757)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>Ch-{ch.ch}</div>
            <div style={{ fontFamily: F, fontSize: 13, color: "#F0F0F0", marginBottom: 14 }}>
              Distribution Channel {ch.ch}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: isGreen ? "rgba(61,170,106,.12)" : "rgba(217,59,32,.12)",
              border: `1px solid ${isGreen ? "rgba(61,170,106,.3)" : "rgba(217,59,32,.3)"}`,
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: TC, boxShadow: `0 0 6px ${TC}`, flexShrink: 0 }} />
              <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: TC, letterSpacing: "0.05em" }}>
                {isGreen ? "Green Tier · Healthy" : "Red Tier · Critical"}
              </span>
            </div>
          </div>

          {/* Card 2 — Radial Gauge */}
          <div className="bch-glass" style={{ padding: "22px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>
              PUBLISH RATE
            </div>
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
              <circle ref={gaugeGlowRef} cx="60" cy="60" r="54" fill="none" stroke={TC} strokeWidth="14" strokeLinecap="round"
                opacity="0.1" strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 60 60)" />
              <circle ref={gaugeArcRef} cx="60" cy="60" r="54" fill="none" stroke={TC} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 60 60)" />
              <text x="60" y="55" textAnchor="middle" dominantBaseline="middle"
                fontFamily={M} fontSize="20" fontWeight="700" fill={TC}>
                {pubRate.toFixed(1)}%
              </text>
              <text x="60" y="72" textAnchor="middle" dominantBaseline="middle"
                fontFamily={M} fontSize="8" fill="rgba(255,255,255,0.58)" letterSpacing="0.08em">
                PUB RATE
              </text>
            </svg>
          </div>

          {/* Card 3 — Stats */}
          <div className="bch-glass" style={{ padding: "6px 18px 10px" }}>
            {[
              { label: "Uploaded",   value: ch.uploaded,   color: "rgba(255,255,255,0.88)", barColor: "rgba(255,255,255,0.25)", barW: 100 },
              { label: "AI Created", value: ch.created,    color: "#ff6b7a",                barColor: "#ff4757",                barW: Math.min((ch.created / (ch.created || 1)) * 100, 100) },
              { label: "Published",  value: ch.published,  color: TC,                       barColor: TC,                       barW: Math.min((ch.published / (ch.uploaded || 1)) * 200, 100) },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                padding: "12px 0",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: "rgba(255,255,255,0.60)", fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontFamily: M, fontSize: 13.5, fontWeight: 700, color: row.color }}>{row.value.toLocaleString()}</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${row.barW}%`, height: "100%", background: row.barColor, borderRadius: 2, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Row 1 — Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <div className="bch-metric">
              <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.60)", marginBottom: 10, fontWeight: 500 }}>AI Expansion</div>
              <div style={{ fontFamily: M, fontSize: 32, fontWeight: 700, color: "#F0F0F0", lineHeight: 1, marginBottom: 10 }}>
                +{aiExpPct}%
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 20, padding: "4px 11px",
                fontFamily: F, fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.55)",
              }}>Content multiplied</span>
            </div>

            <div className="bch-metric">
              <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.60)", marginBottom: 10, fontWeight: 500 }}>Pub Drop</div>
              <div style={{ fontFamily: M, fontSize: 32, fontWeight: 700, color: "#ff4757", lineHeight: 1, marginBottom: 10 }}>
                -{pubDropPct.toFixed(1)}%
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: "rgba(255,71,87,.10)", border: "1px solid rgba(255,71,87,.25)",
                borderRadius: 20, padding: "4px 11px",
                fontFamily: F, fontSize: 11.5, fontWeight: 500, color: "#ff6b7a",
              }}>Filtered out</span>
            </div>

            <div className="bch-metric">
              <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.60)", marginBottom: 10, fontWeight: 500 }}>Pub Rate</div>
              <div style={{ fontFamily: M, fontSize: 32, fontWeight: 700, color: TC, lineHeight: 1, marginBottom: 10 }}>
                {pubRate.toFixed(1)}%
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: isGreen ? "rgba(62,201,138,.10)" : "rgba(255,71,87,.10)",
                border: `1px solid ${isGreen ? "rgba(62,201,138,.25)" : "rgba(255,71,87,.25)"}`,
                borderRadius: 20, padding: "4px 11px",
                fontFamily: F, fontSize: 11.5, fontWeight: 500, color: TC,
              }}>{isGreen ? "Above threshold" : "Below threshold"}</span>
            </div>
          </div>

          {/* Row 2 — Pipeline Funnel */}
          <div className="bch-funnel-wrap" style={{ padding: "18px 20px 32px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#F0F0F0", marginBottom: 3 }}>
                Content Pipeline Flow
              </div>
              <div style={{ fontFamily: F, fontSize: 12.5, color: "rgba(255,255,255,0.60)" }}>
                Upload → Create → Publish — hover each stage
              </div>
            </div>
            <div ref={funnelContainerRef} style={{ position: "relative" }}>
              <svg viewBox="0 0 660 210" width="100%" style={{ display: "block", overflow: "visible" }}
                onMouseLeave={() => setFTip(null)}>
                <defs>
                  <linearGradient id={`bup${ch.ch}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,255,255,.06)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,.22)" />
                  </linearGradient>
                  <linearGradient id={`bcr${ch.ch}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,71,87,.45)" />
                    <stop offset="50%" stopColor="rgba(255,100,110,.82)" />
                    <stop offset="100%" stopColor="rgba(255,71,87,.55)" />
                  </linearGradient>
                  <linearGradient id={`bpu${ch.ch}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={TC} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={TC} stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id={`bt1${ch.ch}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,255,255,.15)" />
                    <stop offset="100%" stopColor="rgba(255,71,87,.45)" />
                  </linearGradient>
                  <linearGradient id={`bt2${ch.ch}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,71,87,.45)" />
                    <stop offset="100%" stopColor={TC} stopOpacity="0.35" />
                  </linearGradient>
                  <filter id={`gcr${ch.ch}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id={`gpu${ch.ch}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Segments */}
                <polygon points={`0,${CY-upH/2} 158,${CY-upH/2} 158,${CY+upH/2} 0,${CY+upH/2}`}
                  fill={`url(#bup${ch.ch})`} />
                <polygon points={`158,${CY-upH/2} 218,${CY-crH/2} 218,${CY+crH/2} 158,${CY+upH/2}`}
                  fill={`url(#bt1${ch.ch})`} />
                <polygon points={`218,${CY-crH/2} 408,${CY-crH/2} 408,${CY+crH/2} 218,${CY+crH/2}`}
                  fill={`url(#bcr${ch.ch})`} filter={`url(#gcr${ch.ch})`} />
                <polygon points={`408,${CY-crH/2} 468,${CY-puH/2} 468,${CY+puH/2} 408,${CY+crH/2}`}
                  fill={`url(#bt2${ch.ch})`} />
                <polygon points={`468,${CY-puH/2} 660,${CY-puH/2} 660,${CY+puH/2} 468,${CY+puH/2}`}
                  fill={`url(#bpu${ch.ch})`} filter={`url(#gpu${ch.ch})`} />

                {/* Labels above */}
                <text x="79" y={CY-upH/2-14} textAnchor="middle" fontFamily={F} fontSize="10"
                  fill="rgba(255,255,255,.55)" letterSpacing="1.5">UPLOADED</text>
                <text x="313" y={CY-crH/2-14} textAnchor="middle" fontFamily={F} fontSize="10"
                  fill="#ff6b7a" letterSpacing="1.5">AI CREATED</text>
                <text x="564" y={CY-puH/2-14} textAnchor="middle" fontFamily={F} fontSize="10"
                  fill={TC} letterSpacing="1.5">PUBLISHED</text>

                {/* Values below */}
                <text x="79" y={CY+upH/2+22} textAnchor="middle" fontFamily={M} fontSize="18" fontWeight="700"
                  fill="rgba(255,255,255,.85)">{ch.uploaded.toLocaleString()}</text>
                <text x="79" y={CY+upH/2+36} textAnchor="middle" fontFamily={F} fontSize="11.5" fill="rgba(255,255,255,0.60)">raw files</text>

                <text x="313" y={CY+crH/2+22} textAnchor="middle" fontFamily={M} fontSize="18" fontWeight="700"
                  fill="rgba(255,255,255,.85)">{ch.created.toLocaleString()}</text>
                <text x="313" y={CY+crH/2+36} textAnchor="middle" fontFamily={F} fontSize="11.5" fill="rgba(255,255,255,0.60)">+{aiExpPct}% expanded</text>

                <text x="564" y={CY+puH/2+22} textAnchor="middle" fontFamily={M} fontSize="18" fontWeight="700"
                  fill="rgba(255,255,255,.85)">{ch.published.toLocaleString()}</text>
                <text x="564" y={CY+puH/2+36} textAnchor="middle" fontFamily={F} fontSize="11.5" fill="rgba(255,255,255,0.60)">{pubRate.toFixed(1)}% pub rate</text>

                {/* Transition ratio labels */}
                <text x="188" y={CY+4} textAnchor="middle" fontFamily={M} fontSize="11" fill="rgba(255,255,255,0.62)">×{aiMult.toFixed(1)}</text>
                <text x="438" y={CY+4} textAnchor="middle" fontFamily={M} fontSize="11" fill="rgba(255,255,255,0.62)">{pubRate.toFixed(1)}%</text>

                {/* Hit zones */}
                <rect x="0" y="0" width="218" height="210" fill="transparent" style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => handleFunnelEnter(e, "upload")} onMouseMove={handleFunnelMove} />
                <rect x="218" y="0" width="250" height="210" fill="transparent" style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => handleFunnelEnter(e, "create")} onMouseMove={handleFunnelMove} />
                <rect x="468" y="0" width="192" height="210" fill="transparent" style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => handleFunnelEnter(e, "publish")} onMouseMove={handleFunnelMove} />
              </svg>

              {/* Tooltip */}
              {fTip && (() => {
                const tip = getTipData(fTip.seg);
                const isRight = fTip.seg === "publish";
                return (
                  <div style={{
                    position: "absolute",
                    ...(isRight ? { left: 20 } : { right: 20 }),
                    top: Math.max(0, fTip.y - 100),
                    background: "rgba(8,8,8,.98)",
                    borderRadius: 12,
                    boxShadow: "0 20px 60px rgba(0,0,0,.9)",
                    pointerEvents: "none",
                    zIndex: 100, minWidth: 200, overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,.06)",
                      fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      color: tip.color, letterSpacing: "0.1em",
                    }}>{tip.title}</div>
                    {tip.rows?.map((r, i) => (
                      <div key={i} style={{
                        padding: "6px 14px",
                        borderBottom: i < tip.rows.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
                      }}>
                        <div style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.48)", marginBottom: 1 }}>{r.label}</div>
                        <div style={{ fontFamily: M, fontSize: 13, fontWeight: 700, color: tip.color }}>{r.value}</div>
                        <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{r.unit}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Row 3 — Conversion */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <div className="bch-conv">
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.15)", filter: "blur(30px)", opacity: 0.15, pointerEvents: "none" }} />
              <div style={{ fontFamily: F, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginBottom: 8 }}>Upload → Create</div>
              <div style={{ fontFamily: M, fontSize: 30, fontWeight: 700, color: "#F0F0F0", marginBottom: 4 }}>
                {Math.round((ch.created / ch.uploaded) * 100)}%
              </div>
              <div style={{ fontFamily: F, fontSize: 9, color: "rgba(255,255,255,0.55)" }}>AI expansion rate</div>
            </div>
            <div className="bch-conv">
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, borderRadius: "50%", background: TC, filter: "blur(30px)", opacity: 0.15, pointerEvents: "none" }} />
              <div style={{ fontFamily: F, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginBottom: 8 }}>Create → Publish</div>
              <div style={{ fontFamily: M, fontSize: 30, fontWeight: 700, color: TC, marginBottom: 4 }}>
                {pubRate.toFixed(1)}%
              </div>
              <div style={{ fontFamily: F, fontSize: 9, color: "rgba(255,255,255,0.55)" }}>Content pub rate</div>
            </div>
            <div className="bch-conv">
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, borderRadius: "50%", background: "#ff4757", filter: "blur(30px)", opacity: 0.15, pointerEvents: "none" }} />
              <div style={{ fontFamily: F, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginBottom: 8 }}>Upload → Publish</div>
              <div style={{ fontFamily: M, fontSize: 30, fontWeight: 700, color: "#ff4757", marginBottom: 4 }}>
                {((ch.published / ch.uploaded) * 100).toFixed(1)}%
              </div>
              <div style={{ fontFamily: F, fontSize: 9, color: "rgba(255,255,255,0.55)" }}>End-to-end rate</div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

function SectionFunnel({ theme, onAskAI }) {
  const dash = useDash();
  const { data: staticData } = useJsonData("funnel");
  const { data: explorerStaticData } = useJsonData("explorer");
  const data = useLiveSectionData("funnel", dash?.liveDashboard, staticData);
  const sectionData = data || {
    meta: { tag: "", title: "", sub: "" },
    subTabs: [],
    sankeyTypeOptions: [],
    contentFlowLegend: [],
    dataQualityAlerts: [],
    sankey: {},
    typeTreemapColors: [],
  };
  const [subView, setSubView] = useState("sankey");
  const [insightsOpen, setInsightsOpen] = useState({});
  const [hoveredLang, setHoveredLang] = useState(null);
  const [hoveredType, setHoveredType] = useState(null);
  const [hoveredStage, setHoveredStage] = useState(null);

  // ── 2D Sankey dimension picker ──
  const [dimA, setDimA] = useState("channel");
  const [dimB, setDimB] = useState("platform");

  const DIMS_CONFIG = [
    { k: "pipeline",    label: "Pipeline",  desc: "Upload→Create→Publish",  color: "#3B8BD4" },
    { k: "user",        label: "User",      desc: "Top contributors",        color: "#F472B6" },
    { k: "channel",     label: "Channel",   desc: "Ch-A through Ch-I",      color: "#8B5CF6" },
    { k: "contentType", label: "Content",   desc: "Interview, News…",       color: "#EF9F27" },
    { k: "language",    label: "Language",  desc: "English, Hindi…",        color: "#3EC98A" },
    { k: "status",      label: "Status",    desc: "Published / Unpub",      color: "#ff6b7a" },
    { k: "platform",    label: "Platform",  desc: "YouTube, Reels…",        color: "#45aaf2" },
  ];
  const COMPAT: Record<string,string[]> = {
    pipeline:    ["status"],
    user:        ["contentType", "channel"],
    channel:     ["platform", "status", "user"],
    contentType: ["language", "status", "user"],
    language:    ["platform", "status"],
    status:      [],
    platform:    [],
  };

  const computeSankeyData = (a: string, b: string) => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    if (a === "channel" && b === "platform") return sectionData.sankey?.channel || { nodes: [], links: [] };
    if (a === "contentType" && b === "language") return sectionData.sankey?.content || { nodes: [], links: [] };
    if (a === "pipeline" && b === "status") return {
      nodes: ["Uploads", "AI Created", "Published", "Unpublished"],
      links: [
        { source: "Uploads",    target: "AI Created",  value: TOTAL_UPLOADED },
        { source: "AI Created", target: "Published",   value: TOTAL_PUBLISHED },
        { source: "AI Created", target: "Unpublished", value: TOTAL_CREATED - TOTAL_PUBLISHED },
      ],
    };
    if (a === "channel" && b === "status") {
      const active = CHANNELS.filter(c => c.created > 0);
      const links = [];
      active.forEach(c => {
        if (c.published > 0) links.push({ source: `Ch-${c.ch}`, target: "Published",   value: c.published });
        const u = c.created - c.published;
        if (u > 0)           links.push({ source: `Ch-${c.ch}`, target: "Unpublished", value: u });
      });
      return { nodes: [...active.map(c => `Ch-${c.ch}`), "Published", "Unpublished"], links };
    }
    if (a === "contentType" && b === "status") {
      const active = INPUT_TYPES.filter(t => t.created > 0);
      const links = [];
      active.forEach(t => {
        const name = cap(t.type);
        if (t.published > 0) links.push({ source: name, target: "Published",   value: t.published });
        const u = t.created - t.published;
        if (u > 0)           links.push({ source: name, target: "Unpublished", value: u });
      });
      return { nodes: [...active.map(t => cap(t.type)), "Published", "Unpublished"], links };
    }
    if (a === "language" && b === "status") {
      const active = LANGUAGES.filter(l => l.created > 0);
      const links = [];
      active.forEach(l => {
        if (l.published > 0) links.push({ source: l.lang, target: "Published",   value: l.published });
        const u = l.created - l.published;
        if (u > 0)           links.push({ source: l.lang, target: "Unpublished", value: u });
      });
      return { nodes: [...active.map(l => l.lang), "Published", "Unpublished"], links };
    }
    if (a === "language" && b === "platform") {
      const fd = sectionData.sankey?.funnel;
      if (!fd) return { nodes: [], links: [] };
      const langSet = new Set(["English", "Hindi", "Mixed"]);
      const platSet = new Set(["YouTube", "Reels", "Shorts", "Facebook", "Instagram"]);
      const filtLinks = (fd.links || []).filter(l => langSet.has(l.source) && platSet.has(l.target));
      const usedLangs = [...new Set(filtLinks.map(l => l.source))];
      const usedPlats = [...new Set(filtLinks.map(l => l.target))];
      return { nodes: [...usedLangs, ...usedPlats], links: filtLinks };
    }
    // ── User → Content: distribute each user's created volume across content types ──
    if (a === "user" && b === "contentType") {
      const active = INPUT_TYPES.filter(t => t.created > 0);
      const totalCreated = active.reduce((s, t) => s + t.created, 0);
      const links = [];
      USERS.forEach(u => {
        active.forEach(t => {
          const val = totalCreated > 0 ? Math.round(u.created * (t.created / totalCreated)) : 0;
          if (val > 0) links.push({ source: u.user, target: cap(t.type), value: val });
        });
      });
      const usedTargets = [...new Set(links.map(l => l.target))];
      return { nodes: [...USERS.map(u => u.user), ...usedTargets], links };
    }
    // ── User → Channel: distribute each user's uploads across channels ──
    if (a === "user" && b === "channel") {
      const active = CHANNELS.filter(c => c.uploaded > 0);
      const totalUploaded = active.reduce((s, c) => s + c.uploaded, 0);
      const links = [];
      USERS.forEach(u => {
        active.forEach(c => {
          const val = totalUploaded > 0 ? Math.round(u.uploaded * (c.uploaded / totalUploaded)) : 0;
          if (val > 0) links.push({ source: u.user, target: `Ch-${c.ch}`, value: val });
        });
      });
      const usedTargets = [...new Set(links.map(l => l.target))];
      return { nodes: [...USERS.map(u => u.user), ...usedTargets], links };
    }
    // ── Channel → User: show how channel upload volume distributes across users ──
    if (a === "channel" && b === "user") {
      const active = CHANNELS.filter(c => c.uploaded > 0);
      const totalUserUploads = USERS.reduce((s, u) => s + u.uploaded, 0);
      const links = [];
      active.forEach(c => {
        USERS.forEach(u => {
          const val = totalUserUploads > 0 ? Math.round(c.uploaded * (u.uploaded / totalUserUploads)) : 0;
          if (val > 0) links.push({ source: `Ch-${c.ch}`, target: u.user, value: val });
        });
      });
      return { nodes: [...active.map(c => `Ch-${c.ch}`), ...USERS.map(u => u.user)], links };
    }
    // ── Content → User: show how content type upload volume distributes across users ──
    if (a === "contentType" && b === "user") {
      const active = INPUT_TYPES.filter(t => t.uploaded > 0);
      const totalUserUploads = USERS.reduce((s, u) => s + u.uploaded, 0);
      const links = [];
      active.forEach(t => {
        USERS.forEach(u => {
          const val = totalUserUploads > 0 ? Math.round(t.uploaded * (u.uploaded / totalUserUploads)) : 0;
          if (val > 0) links.push({ source: cap(t.type), target: u.user, value: val });
        });
      });
      return { nodes: [...active.map(t => cap(t.type)), ...USERS.map(u => u.user)], links };
    }
    return { nodes: [], links: [] };
  };

  const activeDimACfg = DIMS_CONFIG.find(d => d.k === dimA);
  const activeDimBCfg = DIMS_CONFIG.find(d => d.k === dimB);
  const validTargets = COMPAT[dimA] || [];
  const INPUT_TYPES = data?.inputTypes || [];
  const LANGUAGES = data?.languages || [];
  const CHANNELS = data?.channels || [];
  const USERS = (explorerStaticData?.users || []).slice(0, 8);
  const TOTAL_UPLOADED = data?.totals?.totalUploaded || 0;
  const TOTAL_CREATED = data?.totals?.totalCreated || 0;
  const TOTAL_PUBLISHED = data?.totals?.totalPublished || 0;
  const PUBLISH_RATE = data?.totals?.publishRate || 0;
  const MULTIPLIER = data?.totals?.multiplier || 0;
  const toggleInsights = (key) =>
    setInsightsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const TICK_OPT = {
    color: theme === "light" ? "#000000" : "#ffffff",
    font: { size: 10, family: "var(--font-mono)" },
  };
  const GRID_OPT = { color: "var(--chart-grid)" };
  const TT_OPT = {
    backgroundColor:
      theme === "dark" ? "rgba(14,15,17,0.92)" : "rgba(255,255,255,0.96)",
    titleColor: "var(--ink)",
    bodyColor: "var(--ink3)",
    padding: 8,
    cornerRadius: 4,
    borderColor: "var(--line)",
    borderWidth: 1,
  };

  const pubRateCanvasRef = useChartJs(
    "funnel-pubrate",
    {
      type: "bar",
      data: {
        labels: INPUT_TYPES.map((t) => t.type),
        datasets: [
          {
            label: "Publish rate %",
            data: INPUT_TYPES.map(
              (t) => +((t.published / t.uploaded) * 100).toFixed(2),
            ),
            backgroundColor: INPUT_TYPES.map((t) => {
              const r = (t.published / t.uploaded) * 100;
              return r > 5
                ? "#30b060CC"
                : r > 0
                  ? "#FF4757CC"
                  : "#ffffff33";
            }),
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: TT_OPT },
        scales: {
          x: {
            ticks: { ...TICK_OPT, callback: (v) => v + "%" },
            grid: GRID_OPT,
          },
          y: {
            ticks: {
              ...TICK_OPT,
              font: { size: 10, family: "var(--font-mono)" },
            },
            grid: GRID_OPT,
          },
        },
      },
    },
    [theme, INPUT_TYPES],
  );

  const SIGNALS = {
    sankey: {
      a: <><span className="sig-val">{TOTAL_CREATED.toLocaleString()}</span> AI outputs generated from <span className="sig-val">{TOTAL_UPLOADED.toLocaleString()}</span> uploads — only <span className="sig-warn">{TOTAL_PUBLISHED.toLocaleString()}</span> reached distribution (<span className="sig-warn">{PUBLISH_RATE}%</span>).</>,
      b: <>The <span className="sig-val">{MULTIPLIER}×</span> input-to-output multiplier creates a large backlog of unpublished content.</>,
    },
    pipeline: {
      a: <>Upload-to-publish pipeline shows <span className="sig-warn">3 bottleneck stages</span> — largest drop-off occurs at the AI processing step.</>,
      b: <>Overall conversion from upload to published output sits at <span className="sig-warn">{PUBLISH_RATE}%</span>, well below the 10% benchmark.</>,
    },
    channels: {
      a: <><span className="sig-val">18</span> channels active — Ch-A and Ch-B together account for <span className="sig-val">41%</span> of all published content this period.</>,
      b: <>6 channels have <span className="sig-warn">zero publications</span> despite receiving consistent upload volume.</>,
    },
    types: {
      a: <>Short-form video achieves the highest publish rate (<span className="sig-pos">8.4%</span>) — docs and podcasts at <span className="sig-warn">near-zero</span> conversion.</>,
      b: <>4 content types account for <span className="sig-val">93%</span> of total upload volume but less than <span className="sig-warn">15%</span> of publications.</>,
    },
  };

  const sig = SIGNALS[subView] || SIGNALS.sankey;

  return (
    <div className="fade-up">
      <div className="sub-tabs">
        {(sectionData.subTabs || []).map(([k, l]) => (
          <div
            key={k}
            className={`sub-tab${subView === k ? " active" : ""}`}
            onClick={() => setSubView(k)}
          >
            {l}
          </div>
        ))}
      </div>

      {subView === "sankey" && (
        <div className="stack">
          <div className="card card-gold" style={{ padding: "24px 26px" }}>

            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 7 }}>
                  SANKEY FLOW · {activeDimACfg?.label} → {activeDimBCfg?.label}
                </div>
                <div style={{ fontFamily: "-apple-system,'SF Pro Display',system-ui,sans-serif", fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.90)", letterSpacing: "-0.025em", lineHeight: 1.15, marginBottom: 5 }}>
                  {activeDimACfg?.label}
                  <span style={{ color: "rgba(255,255,255,0.18)", fontWeight: 300, margin: "0 12px" }}>→</span>
                  {activeDimBCfg?.label}
                  <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.30)", marginLeft: 12, letterSpacing: "-0.01em" }}>flow analysis</span>
                </div>
                <div style={{ fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                  Hover any node or link to highlight its path through the flow
                </div>
              </div>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.contentFlow}
                onToggleInsights={() => toggleInsights("contentFlow")}
                onAskAI={() => onAskAI && onAskAI("Content Flow", { dimA, dimB })}
              />
            </div>

            {/* ── 2D Dimension Picker ── */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 20,
            }}>
              {/* Picker top bar */}
              <div style={{
                padding: "11px 18px",
                borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(255,255,255,0.01)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.18)" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>DIMENSION FILTER</span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(255,255,255,0.16)", letterSpacing: "0.12em", textTransform: "uppercase" }}>SELECT SOURCE &amp; TARGET</span>
              </div>

              {/* Picker columns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 1fr", alignItems: "start", padding: "16px 16px 0" }}>

                {/* SOURCE column */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 9, borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width: 2.5, height: 13, borderRadius: 2, background: "rgba(232,67,45,0.65)" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.36)" }}>SOURCE</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {DIMS_CONFIG.filter(d => (COMPAT[d.k] || []).length > 0).map(dim => {
                      const active = dimA === dim.k;
                      return (
                        <button key={dim.k} onClick={() => {
                          setDimA(dim.k);
                          if (!COMPAT[dim.k]?.includes(dimB)) setDimB(COMPAT[dim.k]?.[0] || "status");
                        }} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "11px 13px", borderRadius: 9, border: "0.5px solid",
                          cursor: "pointer", textAlign: "left", width: "100%",
                          background: active ? "rgba(232,67,45,0.08)" : "transparent",
                          borderColor: active ? "rgba(232,67,45,0.28)" : "rgba(255,255,255,0.05)",
                          transition: "all .15s ease",
                        }}>
                          <div style={{
                            width: 3, height: 32, borderRadius: 3, flexShrink: 0,
                            background: active ? "rgba(232,67,45,0.85)" : "rgba(255,255,255,0.09)",
                            transition: "background .15s ease",
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif",
                              fontSize: 14, fontWeight: active ? 600 : 400,
                              color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.50)",
                              lineHeight: 1.2, letterSpacing: "-0.015em",
                              transition: "color .15s ease",
                            }}>{dim.label}</div>
                            <div style={{
                              fontFamily: "var(--font-mono)", fontSize: 10,
                              color: active ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.20)",
                              marginTop: 3, letterSpacing: "0.01em",
                              transition: "color .15s ease",
                            }}>{dim.desc}</div>
                          </div>
                          {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,67,45,0.90)", flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Arrow connector */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 46, gap: 5 }}>
                  <div style={{ width: 1, height: 20, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.10))" }} />
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    border: "0.5px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.025)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.22)", fontSize: 13,
                  }}>→</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.16)", letterSpacing: "0.12em", textTransform: "uppercase" }}>flows</div>
                  <div style={{ width: 1, height: 20, background: "linear-gradient(to top, transparent, rgba(255,255,255,0.10))" }} />
                </div>

                {/* TARGET column */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 9, borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width: 2.5, height: 13, borderRadius: 2, background: "rgba(232,67,45,0.65)" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.36)" }}>TARGET</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {DIMS_CONFIG.filter(d => new Set(Object.values(COMPAT).flat()).has(d.k)).map(dim => {
                      const isValid = validTargets.includes(dim.k);
                      const active = dimB === dim.k;
                      return (
                        <button key={dim.k} onClick={() => isValid && setDimB(dim.k)} disabled={!isValid} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "11px 13px", borderRadius: 9, border: "0.5px solid",
                          cursor: isValid ? "pointer" : "not-allowed", textAlign: "left", width: "100%",
                          opacity: isValid ? 1 : 0.18,
                          background: active ? "rgba(232,67,45,0.08)" : "transparent",
                          borderColor: active ? "rgba(232,67,45,0.28)" : "rgba(255,255,255,0.05)",
                          transition: "all .15s ease",
                          filter: isValid ? "none" : "saturate(0)",
                        }}>
                          <div style={{
                            width: 3, height: 32, borderRadius: 3, flexShrink: 0,
                            background: active ? "rgba(232,67,45,0.85)" : "rgba(255,255,255,0.09)",
                            transition: "background .15s ease",
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif",
                              fontSize: 14, fontWeight: active ? 600 : 400,
                              color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.50)",
                              lineHeight: 1.2, letterSpacing: "-0.015em",
                              transition: "color .15s ease",
                            }}>{dim.label}</div>
                            <div style={{
                              fontFamily: "var(--font-mono)", fontSize: 10,
                              color: active ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.20)",
                              marginTop: 3, letterSpacing: "0.01em",
                              transition: "color .15s ease",
                            }}>{dim.desc}</div>
                          </div>
                          {active && isValid && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,67,45,0.90)", flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Active footer */}
              <div style={{
                margin: "16px 16px 0",
                borderTop: "0.5px solid rgba(255,255,255,0.05)",
                padding: "11px 0",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>ACTIVE</span>
                <span style={{
                  padding: "4px 12px", borderRadius: 6,
                  background: "rgba(232,67,45,0.10)", border: "0.5px solid rgba(232,67,45,0.25)",
                  fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif",
                  fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em", color: "rgba(255,255,255,0.82)",
                }}>{activeDimACfg?.label}</span>
                <svg width="16" height="8" viewBox="0 0 16 8" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 4h12M10 1.5l3 2.5-3 2.5" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{
                  padding: "4px 12px", borderRadius: 6,
                  background: "rgba(232,67,45,0.10)", border: "0.5px solid rgba(232,67,45,0.25)",
                  fontFamily: "-apple-system,'SF Pro Text',system-ui,sans-serif",
                  fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em", color: "rgba(255,255,255,0.82)",
                }}>{activeDimBCfg?.label}</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(255,255,255,0.18)", letterSpacing: "0.06em" }}>
                  {computeSankeyData(dimA, dimB).links?.length || 0} links
                </span>
              </div>
            </div>

            <GraphFlip
              flipped={!!insightsOpen.contentFlow}
              minHeight={380}
              front={
                <>
                  <D3SankeyChart type="custom" theme={theme} dataMap={{ custom: computeSankeyData(dimA, dimB) }} />
                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" }}>LEGEND</span>
                    <span style={{ padding: "2px 9px", borderRadius: 4, background: `${activeDimACfg?.color}18`, border: `1px solid ${activeDimACfg?.color}33`, fontFamily: "var(--font-mono)", fontSize: 10, color: activeDimACfg?.color }}>{activeDimACfg?.label} nodes</span>
                    <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 11 }}>→</span>
                    <span style={{ padding: "2px 9px", borderRadius: 4, background: `${activeDimBCfg?.color}18`, border: `1px solid ${activeDimBCfg?.color}33`, fontFamily: "var(--font-mono)", fontSize: 10, color: activeDimBCfg?.color }}>{activeDimBCfg?.label} nodes</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.22)", marginLeft: 6 }}>· hover any node or link to highlight path</span>
                  </div>
                </>
              }
              back={<GraphInsights title="Content Flow" insights={[
                { type: 'warning', heading: '97.5% of content never reaches a distribution node', body: 'The Sankey confirms that the flow collapses almost entirely at the Created → Published transition. This is not a thin stream — it is a near-total blockage. Only 111 of 15,119 created pieces cross the publish threshold.' },
                { type: 'signal',  heading: 'Ch-A receives 19% of uploads but delivers 41% of published content', body: 'Channel A shows a disproportionate conversion efficiency. Its internal workflow — whether content type selection, team process, or platform targeting — is meaningfully different from the fleet average.' },
                { type: 'info',    heading: 'Non-English content drops out almost entirely post-creation', body: 'Hindi, Mixed, Spanish, and Arabic content together represent 41% of uploads, but their share of published output is near zero. Language-specific distribution barriers — platform availability, subtitle requirements — may be the cause.' },
              ]} />}
            />
          </div>
        </div>
      )}

      {subView === "pipeline" && (() => {
        const SF = '-apple-system,"SF Pro Display","SF Pro Text",system-ui,sans-serif';
        const MONO = 'var(--font-mono)';
        const totalUp   = LANGUAGES.reduce((s, l) => s + l.uploaded,  0);
        const totalCr   = LANGUAGES.reduce((s, l) => s + l.created,   0);
        const totalPub  = LANGUAGES.reduce((s, l) => s + l.published, 0);
        const totalLost = totalCr - totalPub;
        const globalRate = totalUp > 0 ? (totalPub / totalUp * 100).toFixed(1) : '0.0';
        const publishingLangs = LANGUAGES.filter(l => l.published > 0).length;
        const maxUp  = Math.max(...LANGUAGES.map(l => l.uploaded),  1);
        const maxCr  = Math.max(...LANGUAGES.map(l => l.created),   1);
        const maxPb  = Math.max(...LANGUAGES.map(l => l.published), 1);
        const maxRate = Math.max(...INPUT_TYPES.map(t => t.uploaded > 0 ? t.published / t.uploaded * 100 : 0), 0.1);

        const STAGES = [
          {
            key: 'upload', label: 'Uploaded', value: totalUp, sub: 'raw source files',
            color: 'rgba(255,255,255,0.88)', dim: 'rgba(255,255,255,0.40)',
            glow: 'rgba(255,255,255,0.06)', bar: 'rgba(255,255,255,0.22)',
            detail: `Entry point — ${totalUp.toLocaleString()} files ingested`,
          },
          {
            key: 'create', label: 'AI Created', value: totalCr, sub: `${totalUp > 0 ? (totalCr/totalUp).toFixed(1) : '–'}× expansion`,
            color: 'rgba(232,180,100,0.95)', dim: 'rgba(232,180,100,0.45)',
            glow: 'rgba(232,180,100,0.07)', bar: 'rgba(232,180,100,0.28)',
            detail: `+${(totalCr - totalUp).toLocaleString()} net new pieces generated`,
          },
          {
            key: 'publish', label: 'Published', value: totalPub, sub: `${globalRate}% pub rate`,
            color: 'rgba(74,180,120,0.95)', dim: 'rgba(74,180,120,0.45)',
            glow: 'rgba(74,180,120,0.07)', bar: 'rgba(74,180,120,0.28)',
            detail: `${totalPub.toLocaleString()} pieces distributed live`,
          },
          {
            key: 'lost', label: 'Never Dist.', value: totalLost, sub: `${totalCr > 0 ? (totalLost/totalCr*100).toFixed(1) : 0}% of created`,
            color: 'rgba(220,80,60,0.95)', dim: 'rgba(220,80,60,0.45)',
            glow: 'rgba(220,80,60,0.07)', bar: 'rgba(220,80,60,0.20)',
            detail: `${totalLost.toLocaleString()} pieces stalled in backlog`,
          },
        ];

        return (
          <div className="stack">

            {/* ── Pipeline Stage Flow ── */}
            <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>

              {/* header */}
              <div style={{ padding: '20px 26px 17px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 5 }}>CONTENT PIPELINE</div>
                  <div style={{ fontFamily: SF, fontSize: 21, fontWeight: 600, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                    Upload <span style={{ color: 'rgba(255,255,255,0.22)', fontWeight: 300 }}>→</span> Create <span style={{ color: 'rgba(255,255,255,0.22)', fontWeight: 300 }}>→</span> Publish
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(74,180,120,0.06)', border: '0.5px solid rgba(74,180,120,0.16)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(74,180,120,0.80)' }} />
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'rgba(74,180,120,0.80)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>{globalRate}% published</span>
                </div>
              </div>

              {/* stage cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
                {STAGES.map((s, si) => {
                  const isH = hoveredStage === s.key;
                  const widthPct = Math.min(100, totalCr > 0 ? (s.value / totalCr) * 100 : 0);
                  return (
                    <div
                      key={s.key}
                      onMouseEnter={() => setHoveredStage(s.key)}
                      onMouseLeave={() => setHoveredStage(null)}
                      style={{
                        position: 'relative', padding: '22px 22px 18px',
                        borderRight: si < STAGES.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                        background: isH ? s.glow : 'transparent',
                        transition: 'background .20s ease',
                        cursor: 'default', overflow: 'hidden',
                      }}
                    >
                      {/* top accent line */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                        background: isH ? s.color : 'transparent',
                        transition: 'background .20s ease',
                        borderRadius: '2px 2px 0 0',
                      }} />

                      {/* glow blob behind number */}
                      {isH && (
                        <div style={{
                          position: 'absolute', top: '30%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 80, height: 80, borderRadius: '50%',
                          background: s.color, filter: 'blur(40px)', opacity: 0.10,
                          pointerEvents: 'none',
                        }} />
                      )}

                      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: isH ? s.dim : 'rgba(255,255,255,0.28)', marginBottom: 10, transition: 'color .18s' }}>{s.label}</div>
                      <div style={{ fontFamily: SF, fontSize: 30, fontWeight: 600, color: s.color, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>{s.value.toLocaleString()}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: isH ? s.dim : 'rgba(255,255,255,0.28)', marginBottom: 14, transition: 'color .18s' }}>{s.sub}</div>

                      {/* hover detail line */}
                      <div style={{ fontFamily: MONO, fontSize: 9.5, color: s.dim, opacity: isH ? 1 : 0, transform: isH ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity .18s, transform .18s', marginBottom: 10, lineHeight: 1.4 }}>{s.detail}</div>

                      {/* progress bar */}
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${widthPct}%`, background: isH ? s.color : s.bar, borderRadius: 3, transition: 'background .20s ease, width .4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* flow connector row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '0.5px solid rgba(255,255,255,0.04)', padding: '0 22px' }}>
                {[
                  { from: 'Upload → Create', rate: totalUp > 0 ? (totalCr / totalUp).toFixed(1) + '×' : '–', label: 'AI expansion', c: 'rgba(232,180,100,0.70)' },
                  { from: 'Create → Publish', rate: totalCr > 0 ? (totalPub / totalCr * 100).toFixed(1) + '%' : '–', label: 'publish rate', c: 'rgba(74,180,120,0.70)' },
                  { from: 'Upload → Publish', rate: totalUp > 0 ? (totalPub / totalUp * 100).toFixed(1) + '%' : '–', label: 'end-to-end rate', c: 'rgba(74,180,120,0.55)' },
                ].map((r, ri, arr) => (
                  <div key={ri} style={{ padding: '10px 0', borderRight: ri < arr.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', paddingRight: ri < arr.length - 1 ? 18 : 0, paddingLeft: ri > 0 ? 18 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em' }}>{r.from}</span>
                      <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.06)' }} />
                      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: r.c, fontVariantNumeric: 'tabular-nums' }}>{r.rate}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.20)' }}>{r.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Language Pipeline ── */}
            <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>

              {/* header */}
              <div style={{ padding: '18px 26px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 5 }}>LANGUAGE PIPELINE</div>
                  <div style={{ fontFamily: SF, fontSize: 14, color: 'rgba(255,255,255,0.42)', fontWeight: 400, letterSpacing: '-0.01em' }}>
                    <span style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>{LANGUAGES[0]?.lang}</span> leads with {totalUp > 0 ? (LANGUAGES[0]?.uploaded / totalUp * 100).toFixed(0) : 0}% of uploads
                    <span style={{ color: 'rgba(255,255,255,0.22)', margin: '0 8px' }}>·</span>
                    <span style={{ color: 'rgba(74,180,120,0.80)', fontWeight: 500 }}>{publishingLangs}</span> of {LANGUAGES.length} languages publishing
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden', flexShrink: 0 }}>
                  {[
                    { l: 'Languages',   v: LANGUAGES.length,   c: 'rgba(255,255,255,0.82)' },
                    { l: 'Publishing',  v: publishingLangs,    c: 'rgba(74,180,120,0.85)'  },
                    { l: 'Global Rate', v: globalRate + '%',   c: parseFloat(globalRate) >= 5 ? 'rgba(74,180,120,0.85)' : 'rgba(232,180,100,0.85)' },
                  ].map((b, bi, arr) => (
                    <div key={b.l} style={{ padding: '10px 20px', borderRight: bi < arr.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none', textAlign: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, fontWeight: 700 }}>{b.l}</div>
                      <div style={{ fontFamily: SF, fontSize: 17, color: b.c, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{b.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 90px', padding: '9px 26px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.20)' }}>Language</div>
                {[
                  { l: 'Uploaded',   dot: 'rgba(255,255,255,0.32)' },
                  { l: 'AI Created', dot: 'rgba(232,180,100,0.75)' },
                  { l: 'Published',  dot: 'rgba(74,180,120,0.75)'  },
                ].map(c => (
                  <div key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)' }}>{c.l}</span>
                  </div>
                ))}
                <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)', textAlign: 'right' }}>Rate</div>
              </div>

              {/* language rows */}
              {LANGUAGES.map((l, i) => {
                const pr = l.uploaded > 0 ? l.published / l.uploaded * 100 : 0;
                const expansion = l.uploaded > 0 ? ((l.created / l.uploaded - 1) * 100).toFixed(0) : '0';
                const sharePct = totalUp > 0 ? (l.uploaded / totalUp * 100).toFixed(0) : '0';
                const isHov = hoveredLang === l.lang;
                const pill = pr >= 3
                  ? { c: 'rgba(74,180,120,0.95)',  bg: 'rgba(74,180,120,0.10)', b: 'rgba(74,180,120,0.25)' }
                  : pr > 0
                    ? { c: 'rgba(232,180,100,0.90)', bg: 'rgba(232,180,100,0.08)', b: 'rgba(232,180,100,0.22)' }
                    : { c: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.02)', b: 'rgba(255,255,255,0.08)' };
                const nameColor = i === 0 ? 'rgba(255,255,255,0.92)' : i === 1 ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.38)';
                return (
                  <div
                    key={l.lang}
                    onMouseEnter={() => setHoveredLang(l.lang)}
                    onMouseLeave={() => setHoveredLang(null)}
                    style={{
                      borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                      background: isHov ? 'rgba(255,255,255,0.022)' : 'transparent',
                      transition: 'background .14s ease',
                      cursor: 'default', position: 'relative',
                    }}
                  >
                    {/* left accent */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                      background: isHov ? (pr >= 3 ? 'rgba(74,180,120,0.60)' : pr > 0 ? 'rgba(232,180,100,0.60)' : 'rgba(255,255,255,0.20)') : 'transparent',
                      transition: 'background .14s ease',
                    }} />

                    {/* data row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 90px', padding: '14px 26px 5px', alignItems: 'flex-start', gap: 8 }}>
                      {/* Name */}
                      <div>
                        <div style={{ fontFamily: SF, fontSize: 14, fontWeight: i < 2 ? 600 : 500, color: isHov ? 'rgba(255,255,255,0.92)' : nameColor, letterSpacing: '-0.015em', transition: 'color .14s' }}>{l.lang}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: isHov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)', marginTop: 3, letterSpacing: '0.06em', transition: 'color .14s' }}>{sharePct}% of uploads</div>
                      </div>
                      {/* Uploaded */}
                      <div>
                        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: isHov ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums', transition: 'color .14s' }}>{l.uploaded.toLocaleString()}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>source files</div>
                      </div>
                      {/* AI Created */}
                      <div>
                        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: isHov ? 'rgba(232,180,100,0.95)' : 'rgba(232,180,100,0.78)', fontVariantNumeric: 'tabular-nums', transition: 'color .14s' }}>{l.created.toLocaleString()}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(232,180,100,0.38)', marginTop: 2 }}>+{expansion}% expanded</div>
                      </div>
                      {/* Published */}
                      <div>
                        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: l.published > 0 ? (isHov ? 'rgba(74,180,120,0.98)' : 'rgba(74,180,120,0.82)') : 'rgba(255,255,255,0.18)', fontVariantNumeric: 'tabular-nums', transition: 'color .14s' }}>{l.published.toLocaleString()}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: l.published > 0 ? 'rgba(74,180,120,0.38)' : 'rgba(220,80,60,0.45)', marginTop: 2 }}>
                          {l.published > 0 ? 'distributed' : 'none distributed'}
                        </div>
                      </div>
                      {/* Rate badge */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 1 }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 11, fontWeight: 700,
                          color: pill.c, background: pill.bg, border: `0.5px solid ${pill.b}`,
                          borderRadius: 7, padding: '4px 10px',
                          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
                          boxShadow: isHov ? `0 0 12px ${pill.bg}` : 'none',
                          transition: 'box-shadow .18s ease',
                        }}>{pr.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* mini bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 90px', padding: '3px 26px 12px', gap: 8 }}>
                      <div />
                      {[
                        { val: l.uploaded, max: maxUp, c: isHov ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)', glow: 'rgba(255,255,255,0.10)' },
                        { val: l.created,  max: maxCr, c: isHov ? 'rgba(232,180,100,0.80)' : 'rgba(232,180,100,0.38)', glow: 'rgba(232,180,100,0.12)' },
                        { val: l.published,max: maxPb, c: isHov ? 'rgba(74,180,120,0.90)'  : 'rgba(74,180,120,0.45)',  glow: 'rgba(74,180,120,0.12)' },
                      ].map((bar, bi) => (
                        <div key={bi} style={{ paddingRight: 10 }}>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${bar.max > 0 ? (bar.val / bar.max) * 100 : 0}%`,
                              height: '100%', background: bar.c, borderRadius: 3,
                              transition: 'background .18s ease, width .3s ease',
                              boxShadow: isHov ? `0 0 6px ${bar.glow}` : 'none',
                            }} />
                          </div>
                        </div>
                      ))}
                      <div />
                    </div>

                    {/* hover: inline conversion stats */}
                    {isHov && (
                      <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 90px', padding: '0 26px 10px', gap: 8 }}>
                        <div />
                        {[
                          { v: `${sharePct}% share`, c: 'rgba(255,255,255,0.28)' },
                          { v: `×${l.uploaded > 0 ? (l.created/l.uploaded).toFixed(1) : '–'} mult`, c: 'rgba(232,180,100,0.50)' },
                          { v: `${l.created > 0 ? (l.published/l.created*100).toFixed(1) : '0.0'}% conv`, c: 'rgba(74,180,120,0.50)' },
                        ].map((s, si) => (
                          <div key={si} style={{ fontFamily: MONO, fontSize: 9, color: s.c, letterSpacing: '0.06em' }}>{s.v}</div>
                        ))}
                        <div />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* footer totals */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                {[
                  { l: 'Total Uploaded',    v: totalUp,   c: 'rgba(255,255,255,0.78)', bg: 'rgba(255,255,255,0.01)' },
                  { l: 'Total AI Created',  v: totalCr,   c: 'rgba(232,180,100,0.90)', bg: 'rgba(232,180,100,0.02)' },
                  { l: 'Total Published',   v: totalPub,  c: 'rgba(74,180,120,0.90)',  bg: 'rgba(74,180,120,0.02)'  },
                  { l: 'Never Distributed', v: totalLost, c: 'rgba(220,80,60,0.85)',   bg: 'rgba(220,80,60,0.02)'   },
                ].map((s, si, arr) => (
                  <div key={s.l} style={{ padding: '14px 26px', borderRight: si < arr.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none', background: s.bg }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.26)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 7, fontWeight: 700 }}>{s.l}</div>
                    <div style={{ fontFamily: SF, fontSize: 22, color: s.c, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>{s.v.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Bottom Row: Quality Alerts + Input Type Rates ── */}
            <div className="g-4-6">

              {/* Data Quality Alerts */}
              <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 13px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>DATA QUALITY ALERTS</div>
                </div>
                <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(sectionData.dataQualityAlerts || []).map((a, i) => (
                    <div key={i} className={`callout callout-${a.c}`} style={{ padding: '10px 14px', borderRadius: 9 }}>
                      <div className="c-text" style={{ fontFamily: SF, fontSize: 12.5, fontWeight: 400, marginBottom: 0, lineHeight: 1.5 }}>{a.t}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Input Type Publish Rates */}
              <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 13px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>INPUT TYPE PUBLISH RATES</div>
                  <GraphActionButtons
                    insightsOpen={!!insightsOpen.inputTypePublishRates}
                    onToggleInsights={() => toggleInsights("inputTypePublishRates")}
                  />
                </div>
                <GraphFlip
                  flipped={!!insightsOpen.inputTypePublishRates}
                  minHeight={260}
                  front={
                    <div style={{ padding: '10px 18px 14px' }}>
                      {INPUT_TYPES.slice(0, 8).map((t) => {
                        const rate = t.uploaded > 0 ? (t.published / t.uploaded * 100) : 0;
                        const isHov = hoveredType === t.type;
                        const pct = maxRate > 0 ? (rate / maxRate) * 100 : 0;
                        const barColor = rate > 5
                          ? (isHov ? 'rgba(74,180,120,1.0)'   : 'rgba(74,180,120,0.62)')
                          : rate > 2
                            ? (isHov ? 'rgba(232,180,100,1.0)' : 'rgba(232,180,100,0.62)')
                            : rate > 0
                              ? (isHov ? 'rgba(220,140,60,0.95)' : 'rgba(220,140,60,0.52)')
                              : (isHov ? 'rgba(220,80,60,0.85)'  : 'rgba(220,80,60,0.38)');
                        const textColor = rate > 5 ? 'rgba(74,180,120,0.95)' : rate > 0 ? 'rgba(232,180,100,0.90)' : 'rgba(255,255,255,0.24)';
                        const glowColor = rate > 5 ? 'rgba(74,180,120,0.18)' : rate > 2 ? 'rgba(232,180,100,0.15)' : 'rgba(220,80,60,0.12)';
                        return (
                          <div
                            key={t.type}
                            onMouseEnter={() => setHoveredType(t.type)}
                            onMouseLeave={() => setHoveredType(null)}
                            style={{
                              display: 'grid', gridTemplateColumns: '132px 1fr 58px',
                              alignItems: 'center', gap: 10, padding: '7px 8px',
                              borderRadius: 8, marginBottom: 2,
                              background: isHov ? glowColor : 'transparent',
                              border: isHov ? `0.5px solid ${barColor.replace(/[\d.]+\)$/, '0.25)')}` : '0.5px solid transparent',
                              transition: 'background .14s ease, border .14s ease',
                              cursor: 'default',
                            }}
                          >
                            <div style={{ fontFamily: SF, fontSize: 12.5, fontWeight: isHov ? 500 : 400, color: isHov ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.48)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color .14s' }}>{t.type}</div>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                              <div style={{
                                width: `${Math.max(0.5, pct)}%`, height: '100%',
                                background: barColor, borderRadius: 3,
                                transition: 'background .14s ease, width .3s ease',
                                boxShadow: isHov ? `0 0 8px ${barColor}` : 'none',
                              }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                              <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: textColor, fontVariantNumeric: 'tabular-nums', transition: 'color .14s' }}>{rate.toFixed(1)}%</div>
                              {isHov && <div style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,0.24)', letterSpacing: '0.04em' }}>{t.published}/{t.uploaded}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  }
                  back={<GraphInsights title="Input Type Publish Rates" insights={[
                    { type: 'signal',  heading: 'Short-form video is the only format above the 5% health line', body: 'At 8.4%, short-form video clears the minimum viable publish rate threshold by a meaningful margin. It outperforms the next-best format by 3× and should be prioritized in content strategy decisions.' },
                    { type: 'warning', heading: 'Documentary and podcast formats show 0% publish rate', body: 'Despite non-trivial upload volume, these two formats have never successfully distributed a piece of content. They may be misconfigured for the available platform targets, or lack the post-production steps required for publishing.' },
                    { type: 'info',    heading: 'Format selection is the largest single lever for publish rate', body: 'The spread between the best and median format is 8.4× — larger than any other variable in the system. Shifting upload mix toward high-converting formats would improve the overall rate without changing any pipeline infrastructure.' },
                  ]} />}
                />
              </div>

            </div>
          </div>
        );
      })()}

      {subView === "channels" && <ByChannelTab channels={CHANNELS} />}

      {subView === "types" && (
        <div className="g2">
          <div className="card" style={{ padding: "14px 16px" }}>
            <div
              style={{
                fontSize: 8,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink3)",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>TOP TYPES BY CREATION VOLUME</span>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.topTypes}
                onToggleInsights={() => toggleInsights("topTypes")}
                onAskAI={() =>
                  onAskAI &&
                  onAskAI("Top Types By Creation Volume", INPUT_TYPES)
                }
              />
            </div>
            <GraphFlip
              flipped={!!insightsOpen.topTypes}
              minHeight={220}
              front={
                <>
                  {INPUT_TYPES.slice(0, 6).map((t) => (
                    <BarRow
                      key={t.type}
                      label={t.type}
                      value={t.created}
                      max={Math.max(...INPUT_TYPES.map((x) => x.created))}
                      fillClass="bf-gold"
                    />
                  ))}
                </>
              }
              back={<GraphInsights title="Top Types By Creation Volume" />}
            />
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div
              style={{
                fontSize: 8,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink3)",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>TYPE VOLUME TREEMAP</span>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.typeTreemap}
                onToggleInsights={() => toggleInsights("typeTreemap")}
                onAskAI={() =>
                  onAskAI && onAskAI("Type Volume Treemap", INPUT_TYPES)
                }
              />
            </div>
            <GraphFlip
              flipped={!!insightsOpen.typeTreemap}
              minHeight={220}
              front={
                <Treemap
                  data={INPUT_TYPES.slice(0, 6).map((t, i) => ({
                    label: t.type.substring(0, 11),
                    value: t.created,
                    color: sectionData.typeTreemapColors[i],
                    note: `${t.published} published`,
                  }))}
                  height={220}
                />
              }
              back={<GraphInsights title="Type Volume Treemap" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SectionFunnel;
