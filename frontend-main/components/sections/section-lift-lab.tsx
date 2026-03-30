// @ts-nocheck
import { useState, useRef, useCallback } from "react";
import GraphInsights from "../ui/GraphInsights";
import GraphFlip from "../ui/GraphFlip";
import { fetchLiftScore } from "@/lib/api";

const SAMPLE_LIFT = {
  best_platform: "YouTube Shorts",
  probability: 0.74,
  rankings: [
    { platform: "YouTube Shorts", probability: 0.74 },
    { platform: "Instagram Reels", probability: 0.62 },
    { platform: "TikTok", probability: 0.58 },
  ],
  meta: { features: ["topic", "language", "platforms", "country", "hashtag_count", "engagement_score"] },
};

/* ─── Growth model ─── */
const baseGrowth = (h: number) => {
  const tau = 20, maxV = 4900;
  return Math.round(maxV * (1 - Math.exp(-h / tau)));
};

const scenGrowth = (h: number, delayH: number, upliftPct: number) => {
  const eff = Math.max(0, h - delayH);
  const tau = 17, maxV = 4900 * (1 + upliftPct / 100);
  return Math.round(maxV * (1 - Math.exp(-eff / tau)));
};

/* ─── Interactive SVG Forecast Chart ─── */
function ForecastChart({ delayH, upliftPct }: { delayH: number; upliftPct: number }) {
  const [mouse, setMouse] = useState<{ px: number; py: number; h: number; base: number; scen: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const contRef = useRef<HTMLDivElement>(null);

  const W = 800, H = 360;
  const PAD = { t: 28, r: 36, b: 52, l: 76 };
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;

  const HOURS = Array.from({ length: 49 }, (_, i) => i);

  const maxV = Math.max(...HOURS.map(h => scenGrowth(h, delayH, upliftPct) * 1.22), 5500);

  const xS = (h: number) => PAD.l + (h / 48) * IW;
  const yS = (v: number) => PAD.t + IH - Math.max(0, (v / maxV)) * IH;

  const linePath = (pts: { h: number; v: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"} ${xS(p.h).toFixed(1)} ${yS(p.v).toFixed(1)}`).join(" ");

  const bandPath = (pts: { h: number; v: number }[], f: number) => {
    const up = pts.map(p => ({ h: p.h, v: p.v * (1 + f) }));
    const dn = pts.map(p => ({ h: p.h, v: p.v * (1 - f) }));
    const upPath = up.map((p, i) => `${i ? "L" : "M"} ${xS(p.h).toFixed(1)} ${yS(p.v).toFixed(1)}`).join(" ");
    const dnPath = [...dn].reverse().map(p => `L ${xS(p.h).toFixed(1)} ${yS(p.v).toFixed(1)}`).join(" ");
    return upPath + " " + dnPath + " Z";
  };

  const basePts = HOURS.map(h => ({ h, v: baseGrowth(h) }));
  const scenPts = HOURS.map(h => ({ h, v: scenGrowth(h, delayH, upliftPct) }));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    const contRect = contRef.current?.getBoundingClientRect();
    if (!svgRect || !contRect) return;
    const scale = svgRect.width / W;
    const relX = (e.clientX - svgRect.left) / scale - PAD.l;
    const h = Math.max(0, Math.min(48, Math.round((relX / IW) * 48)));
    const px = e.clientX - contRect.left;
    const py = e.clientY - contRect.top;
    setMouse({ px, py, h, base: baseGrowth(h), scen: scenGrowth(h, delayH, upliftPct) });
  }, [delayH, upliftPct]);

  const yTicks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000].filter(v => v <= maxV * 1.05);
  const xTicks = [0, 6, 12, 18, 24, 30, 36, 42, 48];

  const uplift = mouse ? Math.round(((mouse.scen - mouse.base) / Math.max(mouse.base, 1)) * 100) : 0;

  return (
    <div ref={contRef} style={{ position: "relative", userSelect: "none" }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMouse(null)}
      >
        <defs>
          <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(232,67,45,0.18)" />
            <stop offset="100%" stopColor="rgba(232,67,45,0)" />
          </linearGradient>
          <linearGradient id="scenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map(v => (
          <line key={v} x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {xTicks.map(h => (
          <line key={h} x1={xS(h)} y1={PAD.t} x2={xS(h)} y2={PAD.t + IH}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        ))}

        {/* Confidence bands */}
        <path d={bandPath(basePts, 0.14)} fill="rgba(232,67,45,0.07)" />
        <path d={bandPath(scenPts, 0.18)} fill="rgba(255,255,255,0.04)" />

        {/* Area fills */}
        <path d={linePath(basePts) + ` L ${xS(48)} ${yS(0)} L ${xS(0)} ${yS(0)} Z`} fill="url(#baseGrad)" />
        <path d={linePath(scenPts) + ` L ${xS(48)} ${yS(0)} L ${xS(0)} ${yS(0)} Z`} fill="url(#scenGrad)" />

        {/* Scenario line — white dashed */}
        <path d={linePath(scenPts)} fill="none"
          stroke="rgba(255,255,255,0.65)" strokeWidth={2.2}
          strokeDasharray="9 5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Baseline line — Frammer red */}
        <path d={linePath(basePts)} fill="none"
          stroke="rgba(232,67,45,0.9)" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Delay marker */}
        {delayH > 0 && (
          <g>
            <line x1={xS(delayH)} y1={PAD.t} x2={xS(delayH)} y2={PAD.t + IH}
              stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} strokeDasharray="4 3" />
            <rect x={xS(delayH) - 24} y={PAD.t + 4} width={48} height={16} rx={4}
              fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.8} />
            <text x={xS(delayH)} y={PAD.t + 15} textAnchor="middle"
              fill="rgba(255,255,255,0.45)" fontSize={9} fontFamily="var(--font-mono)">
              +{delayH}h delay
            </text>
          </g>
        )}

        {/* Crosshair */}
        {mouse && (
          <>
            <line x1={mouse.px < contRef.current?.getBoundingClientRect()?.width / 2 ? xS(mouse.h) : xS(mouse.h)}
              y1={PAD.t} x2={xS(mouse.h)} y2={PAD.t + IH}
              stroke="rgba(232,67,45,0.35)" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={xS(mouse.h)} cy={yS(mouse.base)} r={5}
              fill="rgba(232,67,45,1)" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
            <circle cx={xS(mouse.h)} cy={yS(mouse.scen)} r={5}
              fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
          </>
        )}

        {/* Y axis labels */}
        {yTicks.map(v => (
          <text key={v} x={PAD.l - 10} y={yS(v) + 4}
            textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="var(--font-mono)">
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          </text>
        ))}

        {/* X axis labels */}
        {xTicks.map(h => (
          <text key={h} x={xS(h)} y={PAD.t + IH + 22}
            textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="var(--font-mono)">
            {h === 0 ? "Now" : `+${h}h`}
          </text>
        ))}

        {/* Axis titles */}
        <text x={28} y={PAD.t + IH / 2} textAnchor="middle"
          fill="rgba(255,255,255,0.22)" fontSize={10} fontFamily="var(--font-mono)"
          transform={`rotate(-90, 28, ${PAD.t + IH / 2})`}>
          EXPECTED LIKES
        </text>
        <text x={PAD.l + IW / 2} y={H - 6} textAnchor="middle"
          fill="rgba(255,255,255,0.22)" fontSize={10} fontFamily="var(--font-mono)">
          TIMELINE (NEXT 48 HOURS)
        </text>

        {/* Invisible hover area */}
        <rect x={PAD.l} y={PAD.t} width={IW} height={IH} fill="transparent" />
      </svg>

      {/* Hover tooltip */}
      {mouse && (
        <div style={{
          position: "absolute",
          left: mouse.px + 16,
          top: Math.max(8, mouse.py - 60),
          pointerEvents: "none",
          background: "rgba(10,10,12,0.96)",
          border: "1px solid rgba(232,67,45,0.25)",
          borderRadius: 8,
          padding: "10px 14px",
          minWidth: 170,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          zIndex: 10,
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
            T+{mouse.h}h · {mouse.h > 23 ? `Day ${Math.floor(mouse.h / 24)} +${mouse.h % 24}h` : `Day 1`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(232,67,45,0.9)", flexShrink: 0 }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Baseline</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(232,67,45,0.9)", marginLeft: "auto" }}>
              {mouse.base.toLocaleString()}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.7)", flexShrink: 0 }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Scenario</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.9)", marginLeft: "auto" }}>
              {mouse.scen.toLocaleString()}
            </div>
          </div>
          {mouse.base > 50 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: uplift >= 0 ? "rgba(48,201,120,0.85)" : "rgba(232,67,45,0.85)" }}>
              {uplift >= 0 ? "▲" : "▼"} {Math.abs(uplift)}% lift from scenario
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 22, height: 2.5, background: "rgba(232,67,45,0.9)", borderRadius: 2 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>Scenario A — Publish Now (Baseline)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="22" height="6" style={{ overflow: "visible" }}>
            <line x1="0" y1="3" x2="22" y2="3" stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeDasharray="6 4" />
          </svg>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>Scenario B — +{upliftPct}% Uplift · +{delayH}h Delay</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Lift Summary Results ─── */
function LiftSummary({ lift }) {
  const pct = Math.round(lift.probability * 100);
  const features = lift.meta?.features || ["topic", "language", "platforms", "country", "hashtag_count", "engagement_score"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
      {/* Top winner */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: "16px 18px", background: "rgba(232,67,45,0.07)", border: "1px solid rgba(232,67,45,0.2)", borderRadius: 10, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, rgba(232,67,45,0.7), rgba(232,67,45,0.1))" }} />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "rgba(232,67,45,0.7)", textTransform: "uppercase", marginBottom: 8 }}>Best Platform</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)", marginBottom: 4 }}>{lift.best_platform}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            <span style={{ color: "rgba(232,67,45,0.9)", fontSize: 16, fontWeight: 700 }}>{pct}%</span> top-quartile probability
          </div>
          {/* Confidence bar */}
          <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, rgba(232,67,45,0.8), rgba(232,67,45,0.5))", borderRadius: 4, transition: "width 0.6s ease" }} />
          </div>
        </div>

        <div style={{ padding: "16px 18px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 10 }}>Platform Rankings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lift.rankings.slice(0, 3).map((row, i) => {
              const p = Math.round(row.probability * 100);
              return (
                <div key={row.platform}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: i === 0 ? "rgba(232,67,45,0.8)" : "rgba(255,255,255,0.3)", width: 12 }}>#{i + 1}</div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}>{row.platform}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: i === 0 ? "rgba(232,67,45,0.9)" : "rgba(255,255,255,0.45)" }}>{p}%</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", background: i === 0 ? "rgba(232,67,45,0.7)" : "rgba(255,255,255,0.2)", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>Model Features</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {features.map((f: string) => (
            <div key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "3px 8px" }}>
              {f.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function SectionLiftLab({ onAskAI }) {
  const [liftResult, setLiftResult] = useState(SAMPLE_LIFT);
  const [showInsights, setShowInsights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState("Technology");
  const [region, setRegion] = useState("San Francisco, United States");
  const [language, setLanguage] = useState("en");
  const [engagement, setEngagement] = useState(0.85);
  const [platforms, setPlatforms] = useState("YouTube Shorts, Instagram Reels, TikTok");
  const [hashtags, setHashtags] = useState("#AI, #Tech, #Trending");

  /* Scenario controls */
  const [delayH, setDelayH] = useState(4);
  const [upliftPct, setUpliftPct] = useState(32);

  const parseList = (txt: string) =>
    txt.split(",").map((s) => s.trim()).filter(Boolean);

  const handleScore = async () => {
    setLoading(true);
    setError(null);
    const payload = {
      topic, region, language,
      engagement_score: Number(engagement) || 0,
      hashtags: parseList(hashtags),
    };
    const platList = parseList(platforms);
    const apiResult = await fetchLiftScore(payload);
    if (apiResult) {
      setLiftResult(apiResult);
      setLoading(false);
      return;
    }
    const ranked = platList.length
      ? platList.map((p, i) => ({ platform: p, probability: Math.max(0.35, 0.8 - i * 0.08) }))
      : SAMPLE_LIFT.rankings;
    setLiftResult({
      best_platform: ranked[0].platform,
      probability: ranked[0].probability,
      rankings: ranked,
      meta: SAMPLE_LIFT.meta,
    });
    setError("Demo mode — backend lift model not reachable.");
    setLoading(false);
  };

  const basePeak = baseGrowth(48);
  const scenPeak = scenGrowth(48, delayH, upliftPct);
  const peakLift = Math.round(((scenPeak - basePeak) / basePeak) * 100);

  const INPUT_STYLE = {
    width: "100%", padding: "9px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7, color: "var(--ink)",
    fontFamily: "var(--font-mono)", fontSize: 12,
    outline: "none", transition: "border-color 0.15s",
    boxSizing: "border-box" as const,
  };

  const LABEL_STYLE = {
    fontFamily: "var(--font-mono)", fontSize: 9.5,
    letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase" as const, marginBottom: 5,
    display: "block",
  };

  return (
    <div className="fade-up">
      <div className="sig-block">
        <p className="sig-line">Predict platform lift from video metadata, then simulate causal scenarios — adjust delay and uplift to see forecast impact in real time.</p>
      </div>

      {/* ── Lift Classifier ── */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, rgba(232,67,45,0.7) 0%, rgba(232,67,45,0.1) 60%, transparent 100%)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,67,45,0.8)", boxShadow: "0 0 8px rgba(232,67,45,0.5)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>Lift Classifier · Publish Optimizer</span>
          </div>
          <button
            onClick={() => setShowInsights(v => !v)}
            style={{
              background: showInsights ? "rgba(232,67,45,0.12)" : "transparent",
              border: `1px solid ${showInsights ? "rgba(232,67,45,0.35)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 6, padding: "5px 11px",
              fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em",
              color: showInsights ? "rgba(232,67,45,0.9)" : "rgba(255,255,255,0.4)",
              cursor: "pointer", transition: "all 0.15s",
              textTransform: "uppercase",
            }}
          >
            {showInsights ? "◫ Show Results" : "◫ Show Insights"}
          </button>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>
          Enter video metadata — model scores best platform and predicts publish probability.
        </div>

        {/* Inputs grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
          {[
            { lbl: "Topic", val: topic, set: setTopic },
            { lbl: "Language", val: language, set: setLanguage },
            { lbl: "Region / Market", val: region, set: setRegion },
          ].map(({ lbl, val, set }) => (
            <div key={lbl}>
              <label style={LABEL_STYLE}>{lbl}</label>
              <input value={val} onChange={e => set(e.target.value)} style={INPUT_STYLE}
                onFocus={e => (e.target.style.borderColor = "rgba(232,67,45,0.4)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>
          ))}

          {/* Engagement slider */}
          <div>
            <label style={LABEL_STYLE}>Engagement Score — <span style={{ color: "rgba(232,67,45,0.8)" }}>{engagement.toFixed(2)}</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <input type="range" min="0" max="1" step="0.01" value={engagement}
                onChange={e => setEngagement(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "rgba(232,67,45,0.9)", cursor: "pointer" }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(232,67,45,0.85)", width: 34, textAlign: "right" }}>
                {Math.round(engagement * 100)}%
              </div>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL_STYLE}>Hashtags</label>
            <input value={hashtags} onChange={e => setHashtags(e.target.value)} style={INPUT_STYLE}
              onFocus={e => (e.target.style.borderColor = "rgba(232,67,45,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LABEL_STYLE}>Candidate Platforms</label>
            <input value={platforms} onChange={e => setPlatforms(e.target.value)} style={INPUT_STYLE}
              onFocus={e => (e.target.style.borderColor = "rgba(232,67,45,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
          </div>
        </div>

        {/* Score button + error */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleScore} disabled={loading}
            style={{
              padding: "10px 22px", fontFamily: "var(--font-mono)", fontSize: 11,
              fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              background: loading ? "rgba(255,255,255,0.04)" : "rgba(232,67,45,0.9)",
              color: loading ? "rgba(255,255,255,0.3)" : "#fff",
              border: loading ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(232,67,45,0.4)",
              borderRadius: 8, cursor: loading ? "wait" : "pointer",
              transition: "all 0.18s",
              boxShadow: loading ? "none" : "0 0 20px rgba(232,67,45,0.18)",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 0 28px rgba(232,67,45,0.3)"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = "0 0 20px rgba(232,67,45,0.18)"; }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: 12, height: 12, border: "1.5px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.4)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Scoring...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Score Video
              </>
            )}
          </button>
          {error && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(232,67,45,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.6 }}>⚠</span> {error}
            </div>
          )}
        </div>

        {/* Results / Insights flip */}
        <GraphFlip
          flipped={showInsights}
          minHeight={220}
          front={<LiftSummary lift={liftResult} />}
          back={<GraphInsights title="Lift classifier" insights={[
            { type: "signal", heading: "YouTube Shorts leads at 74% top-quartile probability", body: "For the current content profile, Shorts is the highest-confidence platform pick — outperforming TikTok (58%) and Instagram Reels (62%). Topic and engagement score are the two dominant model features." },
            { type: "info", heading: "Platform rankings are sensitive to language and region", body: "A global one-size strategy underperforms segmented targeting by ~22%. Hindi-language content sees a different platform ranking than English — region-specific targeting is the primary lever." },
            { type: "caution", heading: "Engagement score has outsized model weight", body: "engagement_score and topic together account for the majority of model variance. Improving engagement before scoring yields better lift predictions than any other single optimization." },
          ]} />}
        />
      </div>

      {/* ── Forecast + Causal What-If ── */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, rgba(232,67,45,0.5) 0%, rgba(255,255,255,0.15) 50%, transparent 100%)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>Forecast + Causal What-If</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              Adjust scenario parameters — graph updates in real time. Hover to inspect exact values.
            </div>
          </div>

          {/* Metric pills */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ padding: "6px 12px", background: "rgba(232,67,45,0.07)", border: "1px solid rgba(232,67,45,0.2)", borderRadius: 6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(232,67,45,0.6)", letterSpacing: "0.1em", marginBottom: 2 }}>BASELINE PEAK</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "rgba(232,67,45,0.9)" }}>{basePeak.toLocaleString()}</div>
            </div>
            <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 2 }}>SCENARIO PEAK</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{scenPeak.toLocaleString()}</div>
            </div>
            <div style={{ padding: "6px 12px", background: "rgba(48,201,120,0.07)", border: "1px solid rgba(48,201,120,0.18)", borderRadius: 6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(48,201,120,0.6)", letterSpacing: "0.1em", marginBottom: 2 }}>LIFT</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "rgba(48,201,120,0.9)" }}>+{peakLift}%</div>
            </div>
          </div>
        </div>

        {/* Scenario sliders */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Publish Delay</label>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                +<span style={{ color: "rgba(232,67,45,0.9)" }}>{delayH}</span>h
              </div>
            </div>
            <input type="range" min="0" max="12" step="1" value={delayH}
              onChange={e => setDelayH(Number(e.target.value))}
              style={{ width: "100%", accentColor: "rgba(232,67,45,0.85)", cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>
              <span>Now</span><span>+12h</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Hashtag Uplift</label>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                +<span style={{ color: "rgba(48,201,120,0.85)" }}>{upliftPct}</span>%
              </div>
            </div>
            <input type="range" min="0" max="80" step="1" value={upliftPct}
              onChange={e => setUpliftPct(Number(e.target.value))}
              style={{ width: "100%", accentColor: "rgba(48,201,120,0.8)", cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>
              <span>0%</span><span>80%</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <ForecastChart delayH={delayH} upliftPct={upliftPct} />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
