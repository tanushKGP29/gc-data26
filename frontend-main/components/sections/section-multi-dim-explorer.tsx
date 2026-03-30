// @ts-nocheck
import useJsonData from '@/hooks/useJsonData';
import { useLiveSectionData } from '@/hooks/useDashboardData';
import { useState, useCallback } from "react";
import Treemap from "../charts/Treemap";
import { useDash } from '@/lib/contexts';

/* ── colour ramp helper ─────────────────────────────────────── */
function ramp(baseRgb: string, count: number, a0: number, a1: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0;
    const a = +(a0 - t * (a0 - a1)).toFixed(3);
    return `rgba(${baseRgb},${a})`;
  });
}

/* ── PremiumBarPanel ─────────────────────────────────────────── */
function PremiumBarPanel({
  title,
  items,      // Array<{ name: string, value: number }>
  baseRgb,   // "232,67,45"  or  "255,255,255"
  kpiSuffix, // "" | "%"
  aiInsights,
}: {
  title: string;
  items: { name: string; value: number }[];
  baseRgb: string;
  kpiSuffix: string;
  aiInsights: string[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = items.reduce((s, i) => s + i.value, 0);
  const max = items.length ? Math.max(...items.map(i => i.value)) : 1;

  /* derived stats */
  const top2sum  = items.slice(0, 2).reduce((s, i) => s + i.value, 0);
  const top2pct  = total ? +(top2sum  / total * 100).toFixed(0) : 0;
  const bot2sum  = items.slice(-2).reduce((s, i) => s + i.value, 0);
  const bot2pct  = total ? +(bot2sum  / total * 100).toFixed(0) : 0;
  const top3sum  = items.slice(0, 3).reduce((s, i) => s + i.value, 0);
  const top3pct  = total ? +(top3sum  / total * 100).toFixed(0) : 0;
  const tailCnt  = Math.max(0, items.length - 3);
  const tailPct  = total ? +((total - top3sum) / total * 100).toFixed(0) : 0;

  const heroVal  = hoveredIdx !== null ? items[hoveredIdx]?.value ?? total : total;
  const heroSub  = hoveredIdx !== null
    ? items[hoveredIdx]?.name ?? ''
    : `total items · ${items.length} type${items.length !== 1 ? 's' : ''}`;

  const fmt = (v: number) =>
    kpiSuffix === '%' ? v.toFixed(1) + '%' : v.toLocaleString();

  /* colour ramp */
  const colors = ramp(baseRgb, Math.max(items.length, 1), baseRgb === '232,67,45' ? 0.85 : 0.55, 0.18);

  return (
    <div style={{
      background: '#090909',
      border: '0.5px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── header: hero + chips ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        {/* hero number */}
        <div>
          <div style={{
            fontFamily: '-apple-system,"SF Pro Display",system-ui,sans-serif',
            fontSize: 40,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.90)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.15s',
          }}>
            {fmt(heroVal)}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
            {heroSub}
          </div>
        </div>

        {/* chips */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 2 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {top2pct > 0 && (
              <span style={{
                fontSize: 10.5,
                background: 'rgba(232,67,45,0.08)',
                border: '0.5px solid rgba(232,67,45,0.15)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'rgba(232,120,100,0.90)',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}>
                Top 2 hold {top2pct}%
              </span>
            )}
            {bot2pct > 0 && (
              <span style={{
                fontSize: 10.5,
                background: 'rgba(232,67,45,0.08)',
                border: '0.5px solid rgba(232,67,45,0.15)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'rgba(232,120,100,0.90)',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}>
                Long tail: bottom 2 = {bot2pct}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* panel title */}
      <div style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.52)',
        marginBottom: 12,
        fontWeight: 600,
      }}>
        {title}
      </div>

      {/* proportional strip label */}
      <div style={{ fontSize: 10, letterSpacing: '0.10em', color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', marginBottom: 5, fontWeight: 500 }}>
        proportional split
      </div>

      {/* proportional strip */}
      <div style={{
        display: 'flex',
        height: 6,
        width: '100%',
        gap: 1,
        marginBottom: 18,
        borderRadius: 3,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {items.map((item, i) => {
          const w = total > 0 ? (item.value / total * 100) : 0;
          return (
            <div
              key={item.name}
              title={`${item.name}: ${fmt(item.value)}`}
              style={{
                width: `${w}%`,
                height: '100%',
                background: colors[i] || colors[colors.length - 1],
                flexShrink: 0,
                minWidth: w > 0.5 ? 1 : 0,
              }}
            />
          );
        })}
      </div>

      {/* rows */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
        {items.map((item, i) => {
          const pct   = total > 0 ? (item.value / total * 100) : 0;
          const barW  = max > 0 ? (item.value / max * 100) : 0;
          const color = colors[i] || colors[colors.length - 1];
          const isHov = hoveredIdx === i;
          const nameColor = i === 0
            ? 'rgba(255,255,255,0.92)'
            : i === 1
              ? 'rgba(255,255,255,0.80)'
              : 'rgba(255,255,255,0.62)';
          const bgAlpha = isHov ? 0.10 : 0.055;

          return (
            <div
              key={item.name}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr 72px 54px 40px',
                alignItems: 'center',
                columnGap: 8,
                height: 52,
                borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.03)' : 'none',
                /* proportional bg fill */
                background: `linear-gradient(to right, rgba(${baseRgb},${bgAlpha}) ${barW}%, rgba(${baseRgb},${isHov ? 0.04 : 0}) ${barW}%)`,
                padding: '0 4px',
                borderRadius: 5,
                cursor: 'default',
                transition: 'background 0.18s ease',
              }}
            >
              {/* rank */}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', userSelect: 'none' }}>
                {i + 1}
              </span>

              {/* name */}
              <span style={{
                fontSize: 13,
                color: nameColor,
                fontWeight: i < 2 ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}>
                {item.name}
              </span>

              {/* mini bar */}
              <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${barW}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 1,
                  transition: 'width 0.45s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>

              {/* count */}
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 500, letterSpacing: '-0.01em' }}>
                {fmt(item.value)}
              </span>

              {/* pct */}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 500 }}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* bottom stat bar */}
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: '0.5px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0 12px',
      }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6, fontWeight: 600 }}>Dominant</div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{items[0]?.name ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {total > 0 ? (items[0]?.value / total * 100).toFixed(1) : 0}% of total
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6, fontWeight: 600 }}>Top 3 Coverage</div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{top3pct}%</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {items.slice(0, 3).map(i => i.name).join(', ')}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6, fontWeight: 600 }}>Long Tail</div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{tailCnt} items</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{tailPct}% of total</div>
        </div>
      </div>

    </div>
  );
}

/* ── main section ────────────────────────────────────────────── */
function SectionMultiDim({ theme, onAskAI }) {
  const dash = useDash();
  const { data: staticData } = useJsonData("multidim");
  const data = useLiveSectionData("multidim", dash?.liveDashboard, staticData);
  const [kpi, setKpi] = useState("uploaded");
  const [view, setView] = useState("bar");

  const INPUT_TYPES = data?.inputTypes || [];
  const LANGUAGES   = data?.languages  || [];
  const kpiOpts     = data?.kpiOptions || [];

  /* value extractor */
  const getVal = (row: any, k: string): number => {
    if (k === 'pub_rate') return row.uploaded > 0 ? +(row.published / row.uploaded * 100).toFixed(2) : 0;
    return row[k] ?? 0;
  };

  /* build panel items */
  const inputItems = INPUT_TYPES.slice(0, 10).map(t => ({ name: t.type, value: getVal(t, kpi) }));
  const langItems  = LANGUAGES.map(l => ({ name: l.lang, value: getVal(l, kpi) }));
  const kpiLabel   = kpiOpts.find(o => o.k === kpi)?.l ?? kpi;
  const kpiSuffix  = kpi === 'pub_rate' ? '%' : '';

  /* treemap data */
  const treemapData = INPUT_TYPES.map((t, i) => ({
    label: t.type.substring(0, 12),
    value: getVal(t, kpi),
    note: `Pub rate: ${t.uploaded > 0 ? (t.published / t.uploaded * 100).toFixed(1) : 0}%`,
    color: (data?.treemapColors || [])[i % 10],
  }));

  /* ai insights (auto-generated from numbers) */
  const inputAI = (() => {
    if (!inputItems.length) return [];
    const total = inputItems.reduce((s, i) => s + i.value, 0);
    const top = inputItems[0];
    const top2pct = total ? +(inputItems.slice(0, 2).reduce((s, i) => s + i.value, 0) / total * 100).toFixed(1) : 0;
    const bottom = inputItems[inputItems.length - 1];
    const botPct = total ? +(bottom.value / total * 100).toFixed(1) : 0;
    return [
      `"${top.name}" is the dominant input type with ${top.value.toLocaleString()} ${kpiLabel.toLowerCase()} items — representing ${total ? (top.value / total * 100).toFixed(1) : 0}% of the total distribution.`,
      `The top 2 types together account for ${top2pct}% of all ${kpiLabel.toLowerCase()} volume, indicating a highly concentrated workload.`,
      `"${bottom.name}" sits at the far end of the long tail with only ${botPct}% share (${bottom.value.toLocaleString()} items) — a potential area for growth or deprioritisation.`,
    ];
  })();

  const langAI = (() => {
    if (!langItems.length) return [];
    const total = langItems.reduce((s, i) => s + i.value, 0);
    const top = langItems[0];
    const top2pct = total ? +(langItems.slice(0, 2).reduce((s, i) => s + i.value, 0) / total * 100).toFixed(1) : 0;
    const tailCnt = langItems.slice(2).length;
    return [
      `"${top.name}" leads with ${top.value.toLocaleString()} ${kpiLabel.toLowerCase()} items — ${total ? (top.value / total * 100).toFixed(1) : 0}% of total language distribution.`,
      `Top 2 languages cover ${top2pct}% of all ${kpiLabel.toLowerCase()} volume — the operation is heavily bilingual.`,
      `${tailCnt} additional language${tailCnt !== 1 ? 's' : ''} exist in the long tail with minimal volume — monitor for emerging content expansion.`,
    ];
  })();

  if (!data) return null;

  return (
    <div className="fade-up">
      {/* ── filter bar ── */}
      <div className="filter-panel">
        <div className="filter-group">
          <div className="filter-group-label">KPI METRIC</div>
          <div className="dim-row">
            {kpiOpts.map((o) => (
              <button
                key={o.k}
                onClick={() => setKpi(o.k)}
                style={{
                  fontSize: 13,
                  padding: '5px 14px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  border: `0.5px solid ${kpi === o.k ? 'rgba(232,67,45,0.40)' : 'rgba(255,255,255,0.08)'}`,
                  background: kpi === o.k ? 'rgba(232,67,45,0.15)' : 'transparent',
                  color: kpi === o.k ? 'rgba(232,120,100,1)' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.14s ease',
                  fontFamily: '-apple-system,"SF Pro Display",system-ui,sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-group-label">VISUALISATION</div>
          <div className="dim-row">
            {(data.viewOptions || []).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                style={{
                  fontSize: 13,
                  padding: '5px 14px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  border: `0.5px solid ${view === k ? 'rgba(232,67,45,0.40)' : 'rgba(255,255,255,0.08)'}`,
                  background: view === k ? 'rgba(232,67,45,0.15)' : 'transparent',
                  color: view === k ? 'rgba(232,120,100,1)' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.14s ease',
                  fontFamily: '-apple-system,"SF Pro Display",system-ui,sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── bar chart view ── */}
      {view === 'bar' && (
        <div className="g2" style={{ alignItems: 'stretch' }}>
          <PremiumBarPanel
            title={`By Input Type — ${kpiLabel}`}
            items={inputItems}
            baseRgb="232,67,45"
            kpiSuffix={kpiSuffix}
            aiInsights={inputAI}
          />
          <PremiumBarPanel
            title={`By Language — ${kpiLabel}`}
            items={langItems}
            baseRgb="255,255,255"
            kpiSuffix={kpiSuffix}
            aiInsights={langAI}
          />
        </div>
      )}

      {/* ── treemap view ── */}
      {view === 'treemap' && (
        <div style={{ background: '#090909', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 0 }}>
          <div style={{ padding: '16px 22px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontFamily: '-apple-system,"SF Pro Text",sans-serif', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', fontWeight: 400 }}>
              Input Type — {kpiLabel} Volume
            </span>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.20)', fontFamily: '-apple-system,"SF Pro Text",sans-serif', letterSpacing: '0.04em' }}>
              Treemap
            </span>
          </div>
          <div style={{ padding: '16px 22px 20px' }}>
            <Treemap data={treemapData} height={340} />
          </div>
        </div>
      )}
    </div>
  );
}

export default SectionMultiDim;
