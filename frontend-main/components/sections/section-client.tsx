// @ts-nocheck
import useJsonData from '@/hooks/useJsonData';
import { useState } from 'react';
import Ring from '../charts/Ring';
import GraphActionButtons from '../ui/GraphActionButtons';
import GraphFlip from '../ui/GraphFlip';
import GraphInsights from '../ui/GraphInsights';

const SF   = '-apple-system,"SF Pro Display","SF Pro Text",system-ui,sans-serif';
const MONO = 'var(--font-mono)';

/* ── tiny reusable stat capsule ── */
function StatCapsule({ icon, label, value, valueColor = 'rgba(255,255,255,0.90)', accent = 'rgba(232,67,45,0.70)' }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', padding: '22px 24px', borderRadius: 14, overflow: 'hidden',
        background: hov ? 'rgba(255,255,255,0.025)' : '#0c0c0e',
        border: `0.5px solid ${hov ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)'}`,
        transition: 'background .18s, border .18s', cursor: 'default',
      }}
    >
      {/* top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: hov ? accent : 'transparent', transition: 'background .18s', borderRadius: '14px 14px 0 0' }} />
      {/* glow blob */}
      {hov && <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 60, height: 60, borderRadius: '50%', background: accent, filter: 'blur(35px)', opacity: 0.12, pointerEvents: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: accent, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>{label}</span>
      </div>
      <div style={{ fontFamily: SF, fontSize: 30, fontWeight: 600, color: valueColor, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

/* ── signal card ── */
function SignalCard({ signal }) {
  const [hov, setHov] = useState(false);
  const MAP = {
    crit: { border: 'rgba(220,60,50,0.55)',  bg: 'rgba(220,60,50,0.06)',  bgH: 'rgba(220,60,50,0.10)', tagC: 'rgba(220,90,70,0.95)'  },
    warn: { border: 'rgba(232,168,60,0.50)', bg: 'rgba(232,168,60,0.05)', bgH: 'rgba(232,168,60,0.09)', tagC: 'rgba(232,180,80,0.90)'  },
    ok:   { border: 'rgba(74,180,120,0.50)', bg: 'rgba(74,180,120,0.04)', bgH: 'rgba(74,180,120,0.08)', tagC: 'rgba(74,180,120,0.90)'  },
  };
  const S = MAP[signal.type] || MAP.warn;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '14px 16px', borderRadius: 10, cursor: 'default',
        background: hov ? S.bgH : S.bg,
        borderLeft: `2.5px solid ${S.border}`,
        border: `0.5px solid ${hov ? S.border : 'rgba(255,255,255,0.06)'}`,
        borderLeft: `2.5px solid ${S.border}`,
        transition: 'background .16s',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: S.tagC, marginBottom: 7, textTransform: 'uppercase' }}>{signal.tag}</div>
      <div style={{ fontFamily: SF, fontSize: 13, color: hov ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.52)', lineHeight: 1.55, transition: 'color .16s' }}>{signal.text}</div>
    </div>
  );
}

/* ── channel card ── */
function ChannelCard({ ch }) {
  const [hov, setHov] = useState(false);
  const rate    = ch.uploaded > 0 ? (ch.published / ch.uploaded) * 100 : 0;
  const mult    = ch.uploaded > 0 ? (ch.created  / ch.uploaded).toFixed(1) : '–';
  const isGreen = rate >= 5;
  const isWarn  = rate > 0 && rate < 5;
  const rateC   = isGreen ? 'rgba(74,180,120,0.95)' : isWarn ? 'rgba(232,180,80,0.90)' : 'rgba(220,70,55,0.85)';
  const glowC   = isGreen ? 'rgba(74,180,120,0.08)' : isWarn ? 'rgba(232,180,80,0.07)' : 'rgba(220,70,55,0.06)';
  const platforms = Object.entries(ch.platforms || {});

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '16px 14px', borderRadius: 12, cursor: 'default',
        background: hov ? glowC : '#0c0c0e',
        border: `0.5px solid ${hov ? (isGreen ? 'rgba(74,180,120,0.22)' : isWarn ? 'rgba(232,180,80,0.20)' : 'rgba(220,70,55,0.20)') : 'rgba(255,255,255,0.07)'}`,
        transition: 'background .16s, border .16s',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: hov ? rateC : 'transparent', transition: 'background .16s', opacity: 0.70 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: hov ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.72)', letterSpacing: '-0.01em', transition: 'color .16s' }}>Ch-{ch.ch}</div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: rateC, background: hov ? `${glowC}` : 'transparent', padding: '2px 7px', borderRadius: 5, border: `0.5px solid ${hov ? rateC.replace(/[\d.]+\)$/, '0.28)') : 'transparent'}`, transition: 'all .16s' }}>
          {rate.toFixed(1)}%
        </div>
      </div>

      {/* mini bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { label: 'Uploaded', val: ch.uploaded, max: ch.uploaded, c: 'rgba(255,255,255,0.22)' },
          { label: 'Created',  val: ch.created,  max: ch.created,  c: 'rgba(232,180,80,0.55)'  },
          { label: 'Published',val: ch.published, max: Math.max(ch.uploaded, 1), c: rateC       },
        ].map(b => (
          <div key={b.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{b.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: hov ? b.c : 'rgba(255,255,255,0.30)', fontVariantNumeric: 'tabular-nums' }}>{b.val.toLocaleString()}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: b.label === 'Published' ? `${Math.min(100, (b.val / Math.max(ch.uploaded, 1)) * 100)}%` : b.label === 'Created' ? '100%' : '100%', height: '100%', background: hov ? b.c : b.c.replace(/[\d.]+\)$/, '0.38)'), borderRadius: 2, transition: 'background .16s' }} />
            </div>
          </div>
        ))}
      </div>

      {/* hover: platform dots */}
      {hov && platforms.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {platforms.map(([p, v]) => (
            <span key={p} style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,0.40)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.04em' }}>{p} {v}</span>
          ))}
        </div>
      )}

      {/* mult badge */}
      <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 9, color: hov ? 'rgba(232,180,80,0.65)' : 'rgba(255,255,255,0.18)', letterSpacing: '0.06em', transition: 'color .16s' }}>×{mult} AI mult</div>
    </div>
  );
}

/* ── pipeline row ── */
function PipelineRow({ r, maxPct }) {
  const [hov, setHov] = useState(false);
  const colorMap = {
    'var(--ink3)':    'rgba(255,255,255,0.55)',
    'var(--gold)':    'rgba(232,180,80,0.90)',
    'var(--gold-lt)': 'rgba(240,196,100,0.90)',
    'var(--amber)':   'rgba(232,168,60,0.90)',
    'var(--red)':     'rgba(220,70,55,0.90)',
    'var(--green)':   'rgba(74,180,120,0.90)',
  };
  const c = colorMap[r.color] || r.color;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid', gridTemplateColumns: '156px 1fr 80px',
        alignItems: 'center', gap: 12, padding: '11px 0',
        borderBottom: '0.5px solid rgba(255,255,255,0.04)',
        background: hov ? 'rgba(255,255,255,0.018)' : 'transparent',
        marginLeft: -14, paddingLeft: 14, marginRight: -14, paddingRight: 14,
        borderRadius: 8, transition: 'background .14s', cursor: 'default',
      }}
    >
      <span style={{ fontFamily: SF, fontSize: 13, color: hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.42)', letterSpacing: '-0.01em', transition: 'color .14s' }}>{r.l}</span>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(r.pct, 100)}%`, height: '100%',
          background: c, borderRadius: 3,
          transition: 'width 0.5s cubic-bezier(.4,0,.2,1), opacity .14s',
          opacity: hov ? 1 : 0.7,
          boxShadow: hov ? `0 0 8px ${c}` : 'none',
        }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: c, textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{r.v}</span>
    </div>
  );
}

export default function SectionClient({ onClose, onAskAI }) {
  const { data }           = useJsonData("client");
  const { data: explorerData } = useJsonData("explorer");
  const [subView, setSubView]     = useState("overview");
  const [insightsOpen, setInsightsOpen] = useState({});
  const [hovCh, setHovCh]         = useState(null);
  const toggleInsights = (key) => setInsightsOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const dataQualityRows = explorerData?.dataQualityRows || [];

  if (!data) return null;

  const CHANNELS = data?.channels || [];
  const publishingChs = CHANNELS.filter(c => c.published > 0).length;
  const deadChs       = CHANNELS.filter(c => c.published === 0).length;
  const topCh         = [...CHANNELS].sort((a, b) => b.published - a.published)[0];

  /* icon map for summary cards */
  const iconAccent = {
    'Client ID':       { color: 'rgba(232,67,45,0.80)',  valueColor: 'rgba(255,255,255,0.88)' },
    'Active Channels': { color: 'rgba(232,180,80,0.85)', valueColor: 'rgba(232,180,80,0.95)'  },
    'Active Users':    { color: 'rgba(255,255,255,0.40)', valueColor: 'rgba(255,255,255,0.82)' },
    'Dataset Period':  { color: 'rgba(232,140,60,0.80)', valueColor: 'rgba(232,155,70,0.95)'  },
  };

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>

      {/* ── Premium Header ── */}
      <div style={{
        padding: '28px 32px 0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(232,67,45,0.85)' }}>CLIENT INTELLIGENCE</span>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', padding: '2px 8px', borderRadius: 4, background: 'rgba(232,67,45,0.08)', border: '0.5px solid rgba(232,67,45,0.22)', color: 'rgba(232,67,45,0.70)', textTransform: 'uppercase' }}>RESTRICTED</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 4 }}>Account Overview</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em' }}>{data.meta?.sub}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
              color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >← Back</button>
        )}
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{ margin: '20px 32px 0', display: 'flex', gap: 2, borderBottom: '0.5px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {[['overview', 'Overview'], ['quality', 'Data Quality']].map(([k, l]) => (
          <div
            key={k}
            onClick={() => setSubView(k)}
            style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', cursor: 'pointer',
              padding: '10px 20px', borderRadius: '8px 8px 0 0',
              color: subView === k ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.32)',
              background: subView === k ? 'rgba(232,67,45,0.08)' : 'transparent',
              borderBottom: subView === k ? '2px solid rgba(232,67,45,0.70)' : '2px solid transparent',
              transition: 'all .15s',
            }}
          >{l}</div>
        ))}
      </div>

      <div style={{ padding: '24px 32px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══════════════════════ OVERVIEW ══════════════════════ */}
        {subView === 'overview' && (<>

          {/* ── Stat Capsules (2×2) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {(data.summaryCards || []).map(m => {
              const cfg = iconAccent[m.l] || { color: 'rgba(232,67,45,0.70)', valueColor: 'rgba(255,255,255,0.88)' };
              return <StatCapsule key={m.l} icon={m.icon} label={m.l} value={m.v} valueColor={cfg.valueColor} accent={cfg.color} />;
            })}
          </div>

          {/* ── Pipeline + Signals ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Pipeline Summary */}
            <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>PIPELINE SUMMARY</div>
                <div style={{ fontFamily: SF, fontSize: 12.5, color: 'rgba(255,255,255,0.32)', fontWeight: 400 }}>Upload → Process → Distribute</div>
              </div>
              {(data.pipelineSummary || []).map(r => <PipelineRow key={r.l} r={r} />)}
            </div>

            {/* Key Signals */}
            <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 14 }}>KEY SIGNALS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data.keySignals || []).map(s => <SignalCard key={s.tag} signal={s} />)}
              </div>
            </div>
          </div>

          {/* ── Channel Breakdown ── */}
          <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 22px' }}>

            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>CHANNEL BREAKDOWN</div>
                <div style={{ fontFamily: SF, fontSize: 12.5, color: 'rgba(255,255,255,0.35)' }}>
                  <span style={{ color: 'rgba(74,180,120,0.82)', fontWeight: 500 }}>{publishingChs} active</span>
                  <span style={{ color: 'rgba(255,255,255,0.20)', margin: '0 7px' }}>·</span>
                  <span style={{ color: 'rgba(220,70,55,0.75)', fontWeight: 500 }}>{deadChs} inactive</span>
                  {topCh && <><span style={{ color: 'rgba(255,255,255,0.20)', margin: '0 7px' }}>·</span>Ch-{topCh.ch} leads with {topCh.published} published</>}
                </div>
              </div>
              {/* mini legend */}
              <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                {[
                  { c: 'rgba(74,180,120,0.80)',  l: '≥5% healthy' },
                  { c: 'rgba(232,180,80,0.80)',  l: '1-5% low'    },
                  { c: 'rgba(220,70,55,0.75)',   l: '0% inactive' },
                ].map(d => (
                  <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.c }} />
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em' }}>{d.l}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {CHANNELS.map(ch => <ChannelCard key={ch.ch} ch={ch} />)}
            </div>
          </div>

        </>)}

        {/* ══════════════════════ DATA QUALITY ══════════════════════ */}
        {subView === 'quality' && (() => {
          const critCount = dataQualityRows.filter(r => r.severity === 'critical').length;
          const warnCount = dataQualityRows.filter(r => r.severity === 'warning').length;
          const totalCount = dataQualityRows.length;
          const uploadedVal = data.pipelineSummary.find(r => r.l === 'Total Uploaded')?.v || '—';
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Page-level header card ── */}
              <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>

                {/* title bar */}
                <div style={{ padding: '22px 28px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(232,67,45,0.80)' }} />
                      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(232,67,45,0.82)' }}>DATA QUALITY LAYER</span>
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 6 }}>
                      Coverage &amp; Integrity Audit
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                      Monitoring {uploadedVal} records across field coverage, ID integrity, and URL validity
                    </div>
                  </div>
                  <GraphActionButtons
                    insightsOpen={!!insightsOpen.dataQuality}
                    onToggleInsights={() => toggleInsights('dataQuality')}
                  />
                </div>

                {/* summary stat row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
                  {[
                    { l: 'Critical Issues', v: critCount, c: 'rgba(220,65,50,0.95)', bg: 'rgba(220,65,50,0.06)', icon: '⚑' },
                    { l: 'Warnings',        v: warnCount, c: 'rgba(232,168,60,0.90)', bg: 'rgba(232,168,60,0.05)', icon: '⚠' },
                    { l: 'Total Checks',    v: totalCount, c: 'rgba(255,255,255,0.65)', bg: 'rgba(255,255,255,0.01)', icon: '◈' },
                  ].map((s, si, arr) => (
                    <div key={s.l} style={{ padding: '18px 28px', background: s.bg, borderRight: si < arr.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: s.c }}>{s.icon}</span>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>{s.l}</span>
                      </div>
                      <div style={{ fontFamily: SF, fontSize: 36, fontWeight: 600, color: s.c, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Completeness Rings ── */}
              {explorerData && (
                <CompletenessScores rings={explorerData.completenessRings || []} />
              )}

              {/* ── Quality Issue Cards ── */}
              <GraphFlip
                flipped={!!insightsOpen.dataQuality}
                minHeight={0}
                front={
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {dataQualityRows.map(row => {
                      const isCrit = row.severity === 'critical';
                      const bc = isCrit ? 'rgba(220,55,45,0.70)' : 'rgba(232,168,60,0.60)';
                      return <QualityCard key={row.l} row={row} bc={bc} isCrit={isCrit} />;
                    })}
                  </div>
                }
                back={<GraphInsights title="Data Quality Layer" insights={[
                  { type: 'warning', heading: '99.3% of records have Unknown team attribution', body: 'Team-level analysis, cost attribution, and performance benchmarking are functionally broken. With team_name NULL on 99.3% of rows, it is impossible to map content output to organizational units.' },
                  { type: 'warning', heading: '68% NULL platform field on published rows', body: '76 of 111 published items have no valid platform destination recorded. Distribution analysis, platform ROI, and channel-level reporting are all significantly understated due to this gap.' },
                  { type: 'caution', heading: '84% ID integrity — ~2,300 duplicates inflating creation count', body: 'Approximately 2,300 job IDs are duplicate or malformed. These are counted in the AI creation metric, meaning the 15,119 "created" figure is likely overstated by up to 15% — which also flatters the 3.4× multiplier.' },
                ]} />}
              />

            </div>
          );
        })()}

      </div>
    </div>
  );
}

/* ── Completeness Scores — interactive ring cards ── */
function CompletenessScores({ rings }) {
  const [hov, setHov] = useState(null);

  const DESC = {
    'Field Coverage':  { icon: '◈', detail: 'Percentage of records where all required fields (team_name, platform, publish_url) contain non-null values.', status: (p) => p >= 80 ? 'Healthy' : p >= 60 ? 'Moderate' : 'Critical' },
    'ID Integrity':    { icon: '⊹', detail: 'Ratio of video/job IDs that are unique and properly formatted — duplicate IDs inflate AI creation counts.', status: (p) => p >= 90 ? 'Healthy' : p >= 75 ? 'Moderate' : 'Critical' },
    'URL Validity':    { icon: '⊳', detail: 'Share of published records with a valid, non-null publish URL confirming successful distribution endpoint.', status: (p) => p >= 70 ? 'Healthy' : p >= 40 ? 'Moderate' : 'Critical' },
  };

  const colorOf = (ring) => {
    const raw = ring.color;
    const map = {
      'var(--gold)':    'rgba(232,180,80,0.90)',
      'var(--gold-lt)': 'rgba(240,200,100,0.90)',
      'var(--amber)':   'rgba(232,155,60,0.88)',
      'var(--pri)':     'rgba(232,67,45,0.88)',
      'var(--red)':     'rgba(220,60,45,0.90)',
      'var(--red-lt)':  'rgba(232,80,60,0.90)',
      'var(--green)':   'rgba(74,180,120,0.90)',
    };
    return map[raw] || raw;
  };

  return (
    <div style={{ background: '#0c0c0e', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>

      {/* header */}
      <div style={{ padding: '18px 28px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2.5, height: 12, borderRadius: 2, background: 'rgba(232,67,45,0.70)' }} />
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>COMPLETENESS SCORES</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>hover to inspect</span>
      </div>

      {/* ring cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rings.length}, 1fr)` }}>
        {rings.map((ring, ri) => {
          const isH   = hov === ring.label;
          const c     = colorOf(ring);
          const meta  = DESC[ring.label] || { icon: '◎', detail: '', status: () => 'Unknown' };
          const statusTxt = meta.status(ring.pct);
          const statusC   = statusTxt === 'Healthy' ? 'rgba(74,180,120,0.90)' : statusTxt === 'Moderate' ? 'rgba(232,168,60,0.85)' : 'rgba(220,65,50,0.90)';

          const SIZE  = 110;
          const SW    = 9;
          const r     = (SIZE - SW) / 2;
          const circ  = 2 * Math.PI * r;
          const offset = circ * (1 - ring.pct / 100);

          return (
            <div
              key={ring.label}
              onMouseEnter={() => setHov(ring.label)}
              onMouseLeave={() => setHov(null)}
              style={{
                position: 'relative', padding: '28px 24px 24px',
                borderRight: ri < rings.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                background: isH ? `${c.replace(/[\d.]+\)$/, '0.05)')}` : 'transparent',
                transition: 'background .20s ease', cursor: 'default', overflow: 'hidden',
              }}
            >
              {/* top glow line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: isH ? c : 'transparent', transition: 'background .20s', borderRadius: '0' }} />

              {/* ambient glow */}
              {isH && <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 140, height: 140, borderRadius: '50%', background: c, filter: 'blur(55px)', opacity: 0.12, pointerEvents: 'none' }} />}

              {/* icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 22 }}>
                <span style={{ fontSize: 13, color: isH ? c : 'rgba(255,255,255,0.28)', transition: 'color .18s' }}>{meta.icon}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: isH ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)', transition: 'color .18s' }}>{ring.label}</span>
              </div>

              {/* SVG ring + centre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
                  <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
                    {/* track */}
                    <circle cx={SIZE/2} cy={SIZE/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={SW} />
                    {/* fill */}
                    <circle
                      cx={SIZE/2} cy={SIZE/2} r={r} fill="none"
                      stroke={c} strokeWidth={isH ? SW + 2 : SW}
                      strokeDasharray={circ} strokeDashoffset={offset}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1), stroke-width .20s, filter .20s', filter: isH ? `drop-shadow(0 0 8px ${c})` : 'none' }}
                    />
                  </svg>
                  {/* centre pct */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: SF, fontSize: 22, fontWeight: 600, color: isH ? c : 'rgba(255,255,255,0.88)', letterSpacing: '-0.03em', lineHeight: 1, transition: 'color .18s', fontVariantNumeric: 'tabular-nums' }}>{ring.pct}%</span>
                  </div>
                </div>

                {/* right-side detail (visible on hover) */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusC, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: statusC, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{statusTxt}</span>
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 13, color: isH ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.22)', lineHeight: 1.60, transition: 'color .20s' }}>{meta.detail}</div>

                  {/* mini fill bar */}
                  <div style={{ marginTop: 14, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${ring.pct}%`, height: '100%', background: isH ? c : c.replace(/[\d.]+\)$/, '0.42)'), borderRadius: 3, transition: 'background .20s, width 0.8s cubic-bezier(.4,0,.2,1)', boxShadow: isH ? `0 0 8px ${c}` : 'none' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em' }}>0%</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: isH ? c.replace(/[\d.]+\)$/, '0.55)') : 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', transition: 'color .18s' }}>{ring.pct}%</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em' }}>100%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QualityCard({ row, bc, isCrit }) {
  const [hov, setHov] = useState(false);
  const bgIdle = isCrit ? 'rgba(220,55,45,0.04)' : 'rgba(232,168,60,0.03)';
  const bgHov  = isCrit ? 'rgba(220,55,45,0.09)' : 'rgba(232,168,60,0.08)';
  const tagBg  = isCrit ? 'rgba(220,55,45,0.12)' : 'rgba(232,168,60,0.10)';
  const tagC   = isCrit ? 'rgba(230,90,72,0.95)' : 'rgba(232,185,80,0.92)';
  const tagB   = isCrit ? 'rgba(220,55,45,0.28)' : 'rgba(232,168,60,0.26)';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', padding: '20px 22px 18px', borderRadius: 14, overflow: 'hidden',
        background: hov ? bgHov : bgIdle,
        border: `0.5px solid ${hov ? bc : 'rgba(255,255,255,0.07)'}`,
        borderLeft: `3px solid ${bc}`,
        transition: 'background .18s, border .18s', cursor: 'default',
      }}
    >
      {/* glow blob on hover */}
      {hov && <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, borderRadius: '50%', background: bc, filter: 'blur(50px)', opacity: 0.08, pointerEvents: 'none' }} />}

      {/* severity badge + title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
              padding: '3px 9px', borderRadius: 5,
              background: tagBg, color: tagC, border: `0.5px solid ${tagB}`,
              textTransform: 'uppercase',
            }}>{isCrit ? '⚑ Critical' : '⚠ Warning'}</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: hov ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.80)', letterSpacing: '-0.02em', lineHeight: 1.2, transition: 'color .18s' }}>{row.l}</div>
        </div>
        {/* big value number */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: SF, fontSize: 34, fontWeight: 600, color: row.c, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', filter: hov ? `drop-shadow(0 0 12px ${row.c})` : 'none', transition: 'filter .20s' }}>{row.v}</div>
        </div>
      </div>

      {/* progress bar */}
      {row.pct != null && (
        <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{
            width: `${Math.min(row.pct, 100)}%`, height: '100%',
            background: hov ? bc.replace(/[\d.]+\)$/, '0.90)') : bc.replace(/[\d.]+\)$/, '0.55)'),
            borderRadius: 4,
            transition: 'width 0.5s cubic-bezier(.4,0,.2,1), background .18s',
            boxShadow: hov ? `0 0 10px ${bc}` : 'none',
          }} />
        </div>
      )}

      {/* detail text */}
      {row.detail && (
        <div style={{ fontFamily: SF, fontSize: 13, color: hov ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.32)', lineHeight: 1.65, transition: 'color .18s' }}>{row.detail}</div>
      )}
    </div>
  );
}
