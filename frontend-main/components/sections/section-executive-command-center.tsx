// @ts-nocheck
import useJsonData from '@/hooks/useJsonData';
import { useLiveSectionData } from '@/hooks/useDashboardData';
import { useState, useEffect } from "react";
import Sparkline from "../charts/Sparkline";
import Ring from "../charts/Ring";
import StackedBarChart from "../charts/StackedBarChart";
import ChannelTable from "../charts/ChannelTable";
import DonutChart from "../charts/DonutCharts";
import RadarChart from "../charts/RadarChart";
import Drawer from "../ui/DrawerChannelDetails";
import GraphActionButtons from "../ui/GraphActionButtons";
import GraphFlip from "../ui/GraphFlip";
import GraphInsights from "../ui/GraphInsights";
import TrustBadge from '@/components/ui/TrustBadge';
import SectionInfoHint from '@/components/ui/SectionInfoHint';
import { useDash } from '@/lib/contexts';
import { M } from '@/lib/constants';

/* ─────────────────────────────────────────────────────────────
   Advanced KPI navigation row — used in Executive summary tab
───────────────────────────────────────────────────────────── */
const ADV_KPI_MODULES = [
  {
    key: 'vvs',
    label: 'Viral Velocity Score',
    abbr: 'VVS',
    desc: 'Predicts viral probability using a power-law model across 60 niche × account-size groups.',
    icon: '⚡',
    tag: 'Prediction Model',
  },
  {
    key: 'cyi',
    label: 'Content Yield Index',
    abbr: 'CYI',
    desc: '5-factor multiplicative model scoring how efficiently uploads convert into distributed output.',
    icon: '◎',
    tag: 'Efficiency Model',
  },
  {
    key: 'pes',
    label: 'Platform Efficiency Score',
    abbr: 'PES',
    desc: 'Measures watch-time per dollar relative to platform market average. PES > 1 = below-average cost.',
    icon: '◈',
    tag: 'Cost Model',
  },
  {
    key: 'gvi',
    label: 'Geo Value Index',
    abbr: 'GVI',
    desc: 'Scores each region by reach per dollar against global CPW average. GVI 100 = at global par.',
    icon: '⊕',
    tag: 'Geo Model',
  },
];

function AdvKpiRow() {
  const dash = useDash();
  const [hovered, setHovered] = useState(null);

  const R      = 'rgba(232,67,45,0.95)';
  const RM     = 'rgba(232,67,45,0.60)';
  const RBG    = 'rgba(232,67,45,0.07)';
  const RBG2   = 'rgba(232,67,45,0.12)';
  const RBD    = 'rgba(232,67,45,0.22)';
  const LINE   = 'rgba(255,255,255,0.07)';
  const INK    = 'rgba(255,255,255,0.90)';
  const INK2   = 'rgba(255,255,255,0.58)';
  const INK3   = 'rgba(255,255,255,0.32)';
  const CARD   = 'rgba(255,255,255,0.025)';
  const MN     = 'var(--font-mono)';
  const SN     = 'var(--font-sans)';

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: `linear-gradient(180deg,${R},${RM})`, flexShrink: 0 }} />
        <span style={{ fontFamily: MN, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK }}>
          Advanced KPIs
        </span>
        <div style={{ flex: 1, height: '0.5px', background: LINE }} />
        <span style={{ fontFamily: MN, fontSize: 11, fontWeight: 600, color: INK3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Click to explore →
        </span>
      </div>

      {/* 4 module blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {ADV_KPI_MODULES.map((mod) => {
          const isHov = hovered === mod.key;
          return (
            <div
              key={mod.key}
              onClick={() => dash?.navigateToExplorerKPI?.(mod.key)}
              onMouseEnter={() => setHovered(mod.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isHov ? RBG2 : CARD,
                border: `1px solid ${isHov ? RBD : LINE}`,
                borderRadius: 12,
                padding: '20px 20px 18px',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.18s ease',
                transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHov ? `0 8px 28px rgba(232,67,45,0.14)` : 'none',
              }}
            >
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: isHov ? `linear-gradient(90deg,${R},${RM},transparent)` : `linear-gradient(90deg,rgba(232,67,45,0.35),transparent)`,
                transition: 'all 0.18s ease',
              }} />

              {/* Abbr badge + icon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <span style={{
                  fontFamily: MN, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                  color: isHov ? R : RM,
                  background: isHov ? RBG2 : 'rgba(232,67,45,0.05)',
                  border: `1px solid ${isHov ? RBD : 'rgba(232,67,45,0.14)'}`,
                  borderRadius: 5, padding: '3px 10px',
                  transition: 'all 0.18s ease',
                  textTransform: 'uppercase',
                }}>
                  {mod.abbr}
                </span>
                <span style={{ fontSize: 18, opacity: isHov ? 0.75 : 0.35, transition: 'opacity 0.18s' }}>{mod.icon}</span>
              </div>

              {/* Full name */}
              <div style={{
                fontFamily: MN, fontSize: 14, fontWeight: 700, color: isHov ? INK : 'rgba(255,255,255,0.78)',
                letterSpacing: '-0.01em', lineHeight: 1.25, marginBottom: 10,
                transition: 'color 0.18s ease',
              }}>
                {mod.label}
              </div>

              {/* Description */}
              <div style={{
                fontFamily: SN, fontSize: 12.5, color: INK2, lineHeight: 1.6,
                marginBottom: 16,
              }}>
                {mod.desc}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: MN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                  color: INK3, textTransform: 'uppercase',
                }}>
                  {mod.tag}
                </span>
                <span style={{
                  fontFamily: MN, fontSize: 11, fontWeight: 700,
                  color: isHov ? R : INK3,
                  transition: 'color 0.18s ease',
                }}>
                  Open →
                </span>
              </div>

              {/* Glow orb */}
              <div style={{
                position: 'absolute', right: -20, bottom: -20, width: 80, height: 80,
                borderRadius: '50%', background: R, filter: 'blur(35px)',
                opacity: isHov ? 0.12 : 0.04, transition: 'opacity 0.18s ease',
                pointerEvents: 'none',
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionExecutive({ addToast, theme, onAskAI }) {
  const dash = useDash();
  const { data: staticData } = useJsonData("executive");
  const data = useLiveSectionData("executive", dash?.liveDashboard, staticData);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCh, setDrawerCh] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState({});
  const [subView, setSubView] = useState("summary");
  const MONTHLY_DATA = data?.monthlyData || [];
  const INPUT_TYPES = data?.inputTypes || [];
  const CHANNELS = data?.channels || [];
  const TOTAL_UPLOADED = data?.totals?.totalUploaded || 0;
  const TOTAL_PUBLISHED = data?.totals?.totalPublished || 0;
  const PUBLISH_RATE = data?.totals?.publishRate || 0;
  const toggleInsights = (key) =>
    setInsightsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!data?.toasts?.length) return;
    const timers = data.toasts.map((toast) =>
      setTimeout(
        () => addToast(toast.text, toast.tone, toast.title),
        toast.delay,
      ),
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [addToast, data]);

  const statusDonut = data?.statusDonut || [];
  const inputRadarData = INPUT_TYPES.slice(0, 6).map((t) => ({
    label: t.type.substring(0, 8),
    value: t.uploaded,
  }));

  if (!data) return null;

  // Derive flashcard data
  const ACTIVE_USERS = 44;
  const PEAK_MONTH = "Feb '26";
  const PEAK_COUNT = 2756;

  const FLASHCARDS = [
    {
      id: 'uploaded', label: 'TOTAL UPLOADED', value: TOTAL_UPLOADED.toLocaleString(),
      sub: '807 hrs source footage', color: 'var(--ink)',
      spark: MONTHLY_DATA.map(m => m.uploaded), accent: '', icon: '↑',
    },
    {
      id: 'published', label: 'PUBLISHED', value: TOTAL_PUBLISHED.toLocaleString(),
      sub: 'distributed to platforms', color: 'var(--suc-lt)',
      spark: MONTHLY_DATA.map(m => m.published), accent: 'card-green', icon: '✓',
    },
    {
      id: 'pub_rate', label: 'PUBLISH RATE', value: `${PUBLISH_RATE}%`,
      sub: '⚠ below 10% benchmark', color: 'var(--dan-lt)',
      spark: null, accent: 'card-red', icon: '⚑',
    },
    {
      id: 'active_channels', label: 'ACTIVE CHANNELS', value: '18 / 18',
      sub: '100% channel coverage', color: 'var(--suc-lt)',
      spark: null, accent: 'card-green', icon: '◈',
    },
    {
      id: 'active_users', label: 'ACTIVE USERS', value: `${ACTIVE_USERS} / 45`,
      sub: '1 zero-upload user (Sumit)', color: 'var(--ink)',
      spark: null, accent: '', icon: '⊞',
    },
    {
      id: 'peak_month', label: 'PEAK MONTH', value: PEAK_MONTH,
      sub: `${PEAK_COUNT.toLocaleString()} outputs · +194% MoM`, color: 'var(--amber-lt)',
      spark: null, accent: 'card-amber', icon: '⬆',
    },
  ];

  const SUB_TABS = [
    ["summary", "Summary"],
    ["signals", "Alerts"],
    ["channels", "Channels"],
    ["content_mix", "Content Mix"],
  ];

  const SIGNALS = {
    summary: {
      a: <><span className="sig-val">{TOTAL_PUBLISHED.toLocaleString()}</span> videos published from <span className="sig-val">{TOTAL_UPLOADED.toLocaleString()}</span> uploads — publish rate at <span className="sig-warn">{PUBLISH_RATE}%</span>, below the 10% benchmark.</>,
      b: <><span className="sig-val">{ACTIVE_USERS} / 45</span> users active, peak month <span className="sig-pos">Feb '26</span> with <span className="sig-val">{PEAK_COUNT.toLocaleString()}</span> outputs.</>,
    },
    signals: {
      a: <>3 <span className="sig-warn">critical operational gaps</span> detected this period — zero-publish months in <span className="sig-warn">Mar, Jul, Sep 2025</span>.</>,
      b: <>Publish rate trending down in Q4 — <span className="sig-warn">1 user</span> with 400+ creations and zero publications flagged.</>,
    },
    channels: {
      a: <><span className="sig-val">18 / 18</span> channels active with 100% coverage — <span className="sig-val">Ch-A</span> leads with highest output volume this period.</>,
      b: <>4 channels show below-average publish rates — heatmap reveals uneven platform distribution.</>,
    },
    content_mix: {
      a: <>Short-form dominates at <span className="sig-val">68%</span> of created output — long-form at <span className="sig-warn">3%</span> publish rate, the lowest tier.</>,
      b: <>Docs and podcast formats account for <span className="sig-warn">near-zero</span> publications despite consistent upload volume.</>,
    },
  };

  const sig = SIGNALS[subView] || SIGNALS.summary;

  return (
    <div className="fade-up">
      <div className="sub-tabs">
        {SUB_TABS.map(([k, l]) => (
          <div key={k} className={`sub-tab${subView === k ? " active" : ""}`} onClick={() => setSubView(k)}>{l}</div>
        ))}
      </div>

      {/* ── SUMMARY ── */}
      {subView === "summary" && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }} className="stagger">
            {FLASHCARDS.map((card) => (
              <div
                key={card.id}
                className={`card ${card.accent} fade-up`}
                style={{ padding: '24px 26px 22px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onClick={() => onAskAI && onAskAI(card.label, { value: card.value, sub: card.sub })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                    {card.label}
                  </div>
                  <span style={{ fontSize: 14, opacity: 0.45 }}>{card.icon}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 36, color: card.color, lineHeight: 1, letterSpacing: '-0.03em', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 12.5, fontFamily: 'var(--font-ui)', color: 'rgba(255,255,255,0.52)', marginTop: 10, lineHeight: 1.45, letterSpacing: '0.01em' }}>
                  {card.sub}
                </div>
                {card.spark && (
                  <div style={{ marginTop: 14 }}>
                    <Sparkline data={card.spark} max={Math.max(...card.spark)} color={card.color} h={24} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Advanced KPI navigation row */}
          <AdvKpiRow />

          {/* Context strip */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 28,
              border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 13,
              overflow: "hidden",
              background: "rgba(9,9,9,0.97)",
            }}
          >
            {(data.contextStrip || []).map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: "18px 24px",
                  borderRight: i < 4 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 20,
                    color: "var(--ink)",
                    lineHeight: 1,
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontFamily: 'var(--font-ui)',
                    color: "rgba(255,255,255,0.52)",
                    marginTop: 6,
                    lineHeight: 1.4,
                    letterSpacing: '0.01em',
                  }}
                >
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── ALERTS ── */}
      {subView === "signals" && (() => {
        const SIG_COLORS = {
          crit: { accent: "#ff4757", bg: "rgba(255,71,87,0.055)", border: "rgba(255,71,87,0.18)", glow: "rgba(255,71,87,0.16)", num: "#ff6b7a", tag: "rgba(255,107,122,0.90)", divider: "rgba(255,71,87,0.10)" },
          warn: { accent: "#ffb340", bg: "rgba(255,179,64,0.055)", border: "rgba(255,179,64,0.18)", glow: "rgba(255,179,64,0.16)", num: "#ffc966", tag: "rgba(255,179,64,0.90)", divider: "rgba(255,179,64,0.10)" },
          ok:   { accent: "#3EC98A", bg: "rgba(62,201,138,0.055)", border: "rgba(62,201,138,0.18)", glow: "rgba(62,201,138,0.16)", num: "#3EC98A", tag: "rgba(62,201,138,0.90)", divider: "rgba(62,201,138,0.10)" },
          info: { accent: "#5B9BF5", bg: "rgba(91,155,245,0.055)", border: "rgba(91,155,245,0.18)", glow: "rgba(91,155,245,0.16)", num: "#7fb3ff", tag: "rgba(127,179,255,0.90)", divider: "rgba(91,155,245,0.10)" },
        };

        const ALERTS = [
          {
            type: "crit",
            tag: "CRITICAL",
            num: "97.5%",
            headline: "of processed content has never been published",
            stat: "Created 15,119  ·  Published 111  ·  Backlog 15,008 videos",
            context: "AI generation is scaling — distribution is not. Every upload adds 3.4 queued pieces to a pipeline that has cleared only 2.5% of its output over 12 months. The backlog is growing at the same rate as production.",
            actions: [
              "Conduct a full distribution pipeline audit — map every bottleneck between creation and publish for each channel, identify whether the block is access, tooling, or team capacity.",
              "Assign weekly distribution ownership to each channel manager with a mandatory minimum publish quota; hold bi-weekly reviews to track clearance rate.",
              "Set a Q2 2026 target of 10% publish rate across all channels; escalate any channel still below 5% by end of quarter.",
            ],
          },
          {
            type: "warn",
            tag: "PATTERN",
            num: "3",
            headline: "months recorded zero published output in 12 months",
            stat: "Affected months: Mar 2025, Jul 2025, Sep 2025  ·  Upload volumes were normal in all three",
            context: "Zero-publish months are not a volume problem — uploads were active in all three periods. The failure is entirely downstream: distribution access gaps, team capacity drops, or workflow breakdown after content is generated.",
            actions: [
              "Run a retrospective root-cause analysis on Mar, Jul, and Sep 2025 — identify the specific team, tooling, or access issue that caused each zero-publish outcome.",
              "Implement a 7-day no-publish alert: automatically flag any active channel that hasn't published in a consecutive 7-day window and escalate to channel owner.",
              "Define a minimum publish cadence policy — at least 2 published pieces per active channel per week — as a baseline operational standard.",
            ],
          },
          {
            type: "ok",
            tag: "MOMENTUM",
            num: "2,756",
            headline: "outputs in Feb 2026 — the 12-month all-time peak",
            stat: "Feb 2026 vs 937 monthly average  ·  +194% MoM  ·  Driven by focused English-language upload batch",
            context: "The pipeline demonstrated it can handle high-volume production bursts. The Feb spike was driven by a concentrated batch strategy, not a systemic change — which means it is replicable. The constraint is pairing production bursts with matched distribution plans.",
            actions: [
              "Document the Feb 2026 upload strategy as a repeatable production template: capture team size, input types, batch size, and turnaround time for future sprint planning.",
              "Schedule a Q1 2026 distribution sprint to convert the Feb backlog before content ages — prioritise high-multiplier clips from interview and news bulletin formats.",
              "Replicate the batch upload model in Q2 2026 with a pre-agreed distribution plan to prevent backlog accumulation from repeating at the next spike.",
            ],
          },
          {
            type: "info",
            tag: "BENCHMARK",
            num: "17.5%",
            headline: "Ch-D publish rate — 7× the platform average of 2.5%",
            stat: "Ch-D: 72 published  ·  412 uploaded  ·  5 active platforms  ·  Best-performing channel in fleet",
            context: "Ch-D's results are structural, not accidental — it maintains active presence across 5 platforms and a disciplined distribution workflow. Its publish rate is replicable across the fleet; the gap between Ch-D and the bottom performers is a workflow gap, not a content quality gap.",
            actions: [
              "Extract and document Ch-D's end-to-end publishing workflow into a best-practice playbook, including platform selection criteria, scheduling cadence, and approval process.",
              "Schedule targeted knowledge-transfer sessions with Ch-B and Ch-C — the two lowest-performing channels by publish rate — using Ch-D's playbook as the training baseline.",
              "Set 5% publish rate as the minimum acceptable standard across all 18 channels, reviewed quarterly, with Ch-D's 17.5% as the aspirational target for top performers.",
            ],
          },
        ];

        return (
          <div style={{ padding: "4px 0" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 3, height: 22, borderRadius: 2, background: "linear-gradient(180deg,#ff4757,#ffb340)", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.88)" }}>
                Active Alerts
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.32)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 12px" }}>
                {ALERTS.length} alerts · Mar 2025 – Feb 2026
              </span>
            </div>

            {/* Alert cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ALERTS.map((alert, idx) => {
                const col = SIG_COLORS[alert.type] || SIG_COLORS.info;
                return (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      background: col.bg,
                      border: `1px solid ${col.border}`,
                      borderRadius: 14,
                      overflow: "hidden",
                    }}
                  >
                    {/* Left accent bar */}
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: col.accent }} />

                    {/* Signal section */}
                    <div style={{ padding: "22px 26px 20px 28px" }}>

                      {/* Type badge + divider */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em",
                          color: col.tag, background: `rgba(255,255,255,0.04)`, border: `1px solid ${col.border}`,
                          borderRadius: 20, padding: "4px 14px", textTransform: "uppercase", flexShrink: 0,
                        }}>
                          {alert.tag}
                        </span>
                        <div style={{ flex: 1, height: "0.5px", background: col.border, opacity: 0.6 }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
                          #{idx + 1} of {ALERTS.length}
                        </span>
                      </div>

                      {/* Hero number + headline */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 46, fontWeight: 700,
                          lineHeight: 1, color: col.num, letterSpacing: "-0.03em", flexShrink: 0,
                        }}>
                          {alert.num}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 500,
                          color: "rgba(255,255,255,0.90)", lineHeight: 1.3, letterSpacing: "-0.01em",
                        }}>
                          {alert.headline}
                        </span>
                      </div>

                      {/* Stat line */}
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: 12.5, color: "rgba(255,255,255,0.40)",
                        letterSpacing: "0.02em", marginBottom: 14,
                      }}>
                        {alert.stat}
                      </div>

                      {/* Context paragraph */}
                      <div style={{
                        fontFamily: "var(--font-sans)", fontSize: 14.5, color: "rgba(255,255,255,0.64)",
                        lineHeight: 1.7,
                      }}>
                        {alert.context}
                      </div>
                    </div>

                    {/* Section divider */}
                    <div style={{ height: "1px", background: col.divider, marginLeft: 28, marginRight: 0 }} />

                    {/* Recommended actions section */}
                    <div style={{ padding: "18px 26px 22px 28px" }}>
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
                        letterSpacing: "0.16em", textTransform: "uppercase",
                        color: col.tag, marginBottom: 14, opacity: 0.80,
                      }}>
                        Recommended Actions
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                        {alert.actions.map((action, ai) => (
                          <div key={ai} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                              color: col.accent, flexShrink: 0, minWidth: 22, paddingTop: 2,
                              opacity: 0.85,
                            }}>
                              {ai + 1}.
                            </span>
                            <span style={{
                              fontFamily: "var(--font-sans)", fontSize: 14.5, color: "rgba(255,255,255,0.74)",
                              lineHeight: 1.65,
                            }}>
                              {action}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Glow orb */}
                    <div style={{ position: "absolute", right: -40, bottom: -40, width: 160, height: 160, borderRadius: "50%", background: col.accent, filter: "blur(55px)", opacity: 0.07, pointerEvents: "none" }} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── CHANNELS ── */}
      {subView === "channels" && (
        <>
          <div className="card card-gold" style={{ padding: 0, marginBottom: 16 }}>
            <div className="card-head">
              <span className="card-lbl">Monthly Upload vs Creation Volume</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-sans)", letterSpacing: "0.01em" }}>
                  Mar 2025 – Feb 2026
                </span>
                <span style={{ fontSize: 11, color: "rgba(48,209,88,0.80)", background: "rgba(48,176,96,0.07)", padding: "3px 9px", borderRadius: 5, border: "0.5px solid rgba(48,176,96,0.18)", fontWeight: 400, fontFamily: "var(--font-sans)" }}>
                  {data.monthlyChart.badge}
                </span>
                <GraphActionButtons
                  insightsOpen={!!insightsOpen.monthly}
                  onToggleInsights={() => toggleInsights("monthly")}
                  onAskAI={() => onAskAI && onAskAI("Monthly Upload vs Creation Volume", MONTHLY_DATA)}
                />
              </div>
            </div>
            <div style={{ padding: "16px 22px 14px" }}>
            <GraphFlip
              flipped={!!insightsOpen.monthly}
              minHeight={280}
              front={
                <>
                  <StackedBarChart data={MONTHLY_DATA} height={240} theme={theme} />
                  <div className="legend" style={{ marginTop: 12, gap: 16 }}>
                    {(data.monthlyChart?.legend || []).map(([l, c]) => (
                      <div key={l} className="leg-item">
                        <div className="leg-dot" style={{ background: c, width: 10, height: 10, borderRadius: 2 }} />
                        <span>{l}</span>
                      </div>
                    ))}
                  </div>
                </>
              }
              back={<GraphInsights title="Monthly Upload vs Creation Volume" insights={[
                { type: 'signal',  heading: 'Feb 2026 spike — 194% above average', body: 'February 2026 produced 2,756 AI outputs, the highest single-month figure in the 12-month window. The surge was driven by a concentrated English-language upload batch, not a systemic volume increase.' },
                { type: 'warning', heading: 'Creation growth does not convert to distribution', body: 'The 3.4× AI multiplier amplifies backlog at the same rate as uploads. Every additional upload generates 3.4 queued pieces that remain unpublished — growth is compounding the bottleneck, not relieving it.' },
                { type: 'info',    heading: 'Batched rather than continuous production', body: 'Upload spikes cluster in Oct–Dec and Feb, suggesting planned content bursts rather than a steady pipeline. A smoother ingest cadence would reduce queue peaks and improve distribution throughput.' },
              ]} />}
            />
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-head">
              <span className="card-lbl">Channel Efficiency Matrix</span>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.channelMatrix}
                onToggleInsights={() => toggleInsights("channelMatrix")}
                onAskAI={() =>
                  onAskAI &&
                  onAskAI("Channel Efficiency Matrix", {
                    channels: CHANNELS,
                  })
                }
              />
              <span
                style={{
                  fontSize: 11.5,
                  fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
                  color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.01em",
                }}
              >
                Click row for deep-dive →
              </span>
            </div>
            <GraphFlip
              flipped={!!insightsOpen.channelMatrix}
              minHeight={280}
              front={
                <div style={{ padding: "7px 0" }}>
                  <ChannelTable
                    channels={CHANNELS}
                    onRowClick={(ch) => {
                      setDrawerCh(ch);
                      setDrawerOpen(true);
                    }}
                  />
                </div>
              }
              back={<GraphInsights title="Channel Efficiency Matrix" insights={[
                { type: 'signal',  heading: 'Ch-A and Ch-D drive 53% of all published content', body: 'These two channels represent only 22% of upload volume but account for more than half of all distributed pieces — a 2.4× efficiency premium over the fleet average.' },
                { type: 'warning', heading: '6 channels have zero publications in 12 months', body: 'Six active channels are consuming upload capacity and AI processing without generating a single published output. This represents dead capital in the pipeline with no return on processing cost.' },
                { type: 'info',    heading: '17× spread in channel publish rate', body: 'Publish rates range from 17.5% (Ch-D) to 0%, indicating structural differences in team workflow, content type selection, or platform access — not random variation.' },
              ]} />}
            />
          </div>
        </>
      )}

      {/* ── CONTENT MIX ── */}
      {subView === "content_mix" && (
        <div className="g2">
          <div className="card" style={{ padding: 0 }}>
            <div className="card-head">
              <span className="card-lbl">Content Status Split</span>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.status}
                onToggleInsights={() => toggleInsights("status")}
                onAskAI={() => onAskAI && onAskAI("Content Status Split", { segments: statusDonut })}
              />
            </div>
            <GraphFlip
              flipped={!!insightsOpen.status}
              minHeight={320}
              front={
                <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "24px 24px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <DonutChart segments={statusDonut} size={190} label="111" sub="published" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {statusDonut.map((s) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 8, height: 8, background: s.color, borderRadius: "50%", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.50)", flex: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 14, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.82)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              }
              back={<GraphInsights title="Content Status Split" insights={[
                { type: 'warning', heading: '97.5% of AI-created content is permanently queued', body: '14,803 pieces have been generated but never distributed. This is not a temporary backlog — the ratio has held constant for 12 months, indicating a structural distribution block, not a timing issue.' },
                { type: 'caution', heading: '2.5% publish rate is 4× below the industry floor', body: 'The benchmark for AI-assisted content workflows is 10–15%. At 2.5%, Frammer is operating at the bottom quartile of distribution efficiency — the bottleneck is downstream, not in generation.' },
                { type: 'info',    heading: 'Unpublished volume grows proportionally with creation', body: 'As AI creation scales, the unpublished pile scales at identical rates. Fixing the distribution pipeline before scaling uploads further is the highest-leverage intervention available.' },
              ]} />}
            />
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="card-head">
              <span className="card-lbl">Input Type Radar</span>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.radar}
                onToggleInsights={() => toggleInsights("radar")}
                onAskAI={() => onAskAI && onAskAI("Input Type Radar", { data: inputRadarData })}
              />
            </div>
            <GraphFlip
              flipped={!!insightsOpen.radar}
              minHeight={320}
              front={
                <div style={{ padding: "20px 16px 16px", display: "flex", justifyContent: "center" }}>
                  <RadarChart data={inputRadarData} size={300} />
                </div>
              }
              back={<GraphInsights title="Input Type Radar" insights={[
                { type: 'signal',  heading: 'Short-form video is the only healthy input type', body: 'At 8.4% publish rate, short-form video is the sole format clearing the 5% health threshold. It outperforms every other type by a factor of at least 3× and should be the primary format focus.' },
                { type: 'warning', heading: 'Podcasts and documents at near-zero conversion', body: 'Despite meaningful upload volume, podcast and document formats have effectively 0% publish rates. These types may be misconfigured for platform delivery or lack appropriate distribution targets.' },
                { type: 'info',    heading: '5 of 8 input types have never published', body: 'More than half of tracked content formats have no distribution history. Format diversification is increasing upload complexity without producing corresponding output — a risk worth auditing.' },
              ]} />}
            />
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channel={drawerCh}
      />
    </div>
  );
}

export default SectionExecutive;
