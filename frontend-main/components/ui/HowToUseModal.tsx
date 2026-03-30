// @ts-nocheck
"use client";
import { useState } from "react";

/* ── Sidebar-matching SVG icons ── */
const OverviewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9"   y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="1.5" y="9"   width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9"   y="9"   width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);
const TrendsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polyline points="1.5,12 5.5,7 9,9.5 14.5,3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="11,3.5 14.5,3.5 14.5,7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SegmentsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="4" r="2" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="3" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="13" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 6C8 6 5.5 7.5 3.8 9.2M8 6C8 6 10.5 7.5 12.2 9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const FunnelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 3h12l-4.5 5.5V13l-3-1.5V8.5L2 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const ExplorerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const CopilotIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2" width="13" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 14l1.5-2.5h3L11 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4.5" y1="6" x2="11.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="4.5" y1="8.5" x2="9"   y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const STEPS = [
  {
    SvgIcon: OverviewIcon,
    title: "Overview",
    accent: "#e8a82d",
    badge: "Mission Control",
    desc: "Your command center — 10 live KPI flashcards give you an instant read on platform health: publish rate, AI creation efficiency, top-performing channels, and critical drop-off alerts.",
    tips: [
      { icon: "▣", text: "Red-border cards = KPIs below threshold — prioritise these" },
      { icon: "⊹", text: "Click 'Ask AI' on any card for an instant AI diagnosis" },
      { icon: "✦", text: "Green cards confirm segments running smoothly" },
    ],
  },
  {
    SvgIcon: TrendsIcon,
    title: "Trends",
    accent: "#4fa3e8",
    badge: "12-Month View",
    desc: "Track upload, AI creation, and publish counts across 12 months. Compare H1 vs H2 performance, isolate channels with the filter, and enable a 3-month forecast to see where things are heading.",
    tips: [
      { icon: "⌇", text: "Toggle between Count and Duration metrics at any time" },
      { icon: "▣", text: "Enable 'Show Forecast' for a linear regression projection" },
      { icon: "✦", text: "H1 vs H2 split reveals seasonal publishing patterns" },
    ],
  },
  {
    SvgIcon: SegmentsIcon,
    title: "Segments",
    accent: "#3ec98a",
    badge: "Channel Analysis",
    desc: "Analyse channels across multiple dimensions at once. Switch between a ranked bar view and a proportional treemap to see which channels dominate uploads, AI creation, or publish volume.",
    tips: [
      { icon: "⬡", text: "Bar view ranks all channels by your selected metric" },
      { icon: "▣", text: "Treemap block size = proportional share of total volume" },
      { icon: "⊹", text: "AI Insights strip auto-highlights the top takeaway" },
    ],
  },
  {
    SvgIcon: FunnelIcon,
    title: "Funnel",
    accent: "#ff4757",
    badge: "Pipeline Flow",
    desc: "Visualise content moving through Upload → AI Creation → Publish. The By Channel view shows a radial gauge and inline SVG funnel with drop-off percentages for each channel.",
    tips: [
      { icon: "▽", text: "Hover any funnel stage for exact volume and rate" },
      { icon: "◉", text: "Radial gauge arc shows publish rate vs. 100% target" },
      { icon: "▣", text: "Channels below 5% publish rate are flagged red" },
    ],
  },
  {
    SvgIcon: ExplorerIcon,
    title: "Explorer",
    accent: "#e8a82d",
    badge: "Deep Diagnostics",
    desc: "Drill into user-level rankings, per-channel breakdowns, and data completeness. Switch between tabs to surface the full KPI hierarchy, top contributors, or records with missing data.",
    tips: [
      { icon: "◈", text: "User Rankings tab shows top contributors by output" },
      { icon: "⌇", text: "Channel Drilldown reveals per-channel pipeline health" },
      { icon: "✦", text: "Data Quality tab flags incomplete or missing records" },
    ],
  },
  {
    SvgIcon: CopilotIcon,
    title: "Copilot",
    accent: "#ff4757",
    badge: "AI Assistant",
    desc: "Chat with your data. Every chart has an 'Ask AI' button that attaches live graph data to the conversation. Choose a mode — Auto, Explain, KPI, or Analytics — to tailor how the AI responds.",
    tips: [
      { icon: "⊹", text: "Use ⌘K to search and jump to any section instantly" },
      { icon: "◈", text: "Switch to KPI mode for metric-focused answers" },
      { icon: "▣", text: "Attached chart sources appear as chips above the input" },
    ],
  },
];

export default function HowToUseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const cur = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 9010, width: 540, maxWidth: "calc(100vw - 24px)",
        background: "#0e0e0e",
        border: "0.5px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        boxShadow: "0 32px 80px rgba(0,0,0,0.90), 0 0 0 0.5px rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>

        {/* Accent line at very top */}
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent 0%, ${cur.accent} 40%, ${cur.accent} 60%, transparent 100%)`, transition: "background 0.3s" }} />

        {/* Header */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>
              Dashboard Guide
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.90)", letterSpacing: "-0.02em" }}>
              How to use Frammer Analytics
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 7, cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1, padding: "5px 9px", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.80)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >×</button>
        </div>

        {/* Section tab bar */}
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.07)", background: "#0a0a0a" }}>
          {STEPS.map((s, i) => {
            const active = step === i;
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                title={s.title}
                style={{
                  flex: 1, padding: "10px 4px 9px", border: "none",
                  borderBottom: active ? `2px solid ${s.accent}` : "2px solid transparent",
                  background: active ? "rgba(255,255,255,0.04)" : "transparent",
                  cursor: "pointer",
                  color: active ? s.accent : "rgba(255,255,255,0.28)",
                  transition: "all 0.18s",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.28)"; }}
              >
                <s.SvgIcon />
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: "22px 24px 20px" }}>

          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${cur.accent}18`,
              border: `0.5px solid ${cur.accent}44`,
              color: cur.accent,
              transition: "all 0.3s",
            }}>
              <cur.SvgIcon />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                  Section {step + 1} of {STEPS.length}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                  background: `${cur.accent}20`, border: `0.5px solid ${cur.accent}44`, borderRadius: 4,
                  padding: "2px 6px", color: cur.accent,
                }}>
                  {cur.badge}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.02em" }}>
                {cur.title}
              </div>
            </div>
          </div>

          {/* Description */}
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 13.5, color: "rgba(255,255,255,0.58)",
            lineHeight: 1.70, marginBottom: 18, letterSpacing: "-0.01em",
          }}>
            {cur.desc}
          </p>

          {/* Tips */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cur.tips.map((tip, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.025)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                  borderRadius: 9,
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${cur.accent}44`; e.currentTarget.style.background = `${cur.accent}08`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: `${cur.accent}18`, border: `0.5px solid ${cur.accent}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: cur.accent,
                }}>
                  {tip.icon}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.60)", lineHeight: 1.50, letterSpacing: "0.01em" }}>
                  {tip.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px 18px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: "0.5px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.01)",
        }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              background: "none", border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 7, padding: "7px 16px",
              cursor: step === 0 ? "not-allowed" : "pointer",
              color: step === 0 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.60)",
              opacity: step === 0 ? 0.5 : 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (step > 0) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = step === 0 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.60)"; }}
          >
            ← Prev
          </button>

          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {STEPS.map((s, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: step === i ? 18 : 6, height: 6, borderRadius: 3,
                  background: step === i ? cur.accent : "rgba(255,255,255,0.15)",
                  cursor: "pointer", transition: "all 0.22s ease",
                }}
              />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                background: `linear-gradient(135deg, ${cur.accent}, ${cur.accent}cc)`,
                border: "none", borderRadius: 7, padding: "7px 16px",
                cursor: "pointer", color: "#fff", fontWeight: 600,
                boxShadow: `0 4px 16px ${cur.accent}44`,
                transition: "all 0.20s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${cur.accent}66`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 16px ${cur.accent}44`; }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                background: "linear-gradient(135deg, #3ec98a, #27ae60)",
                border: "none", borderRadius: 7, padding: "7px 16px",
                cursor: "pointer", color: "#fff", fontWeight: 600,
                boxShadow: "0 4px 16px rgba(62,201,138,0.40)",
                transition: "all 0.20s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(62,201,138,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(62,201,138,0.40)"; }}
            >
              Get started ✓
            </button>
          )}
        </div>
      </div>
    </>
  );
}
