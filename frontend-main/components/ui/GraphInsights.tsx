// @ts-nocheck
const SF   = '-apple-system,"SF Pro Display","SF Pro Text",system-ui,sans-serif';
const MONO = 'var(--font-mono)';

const TYPE_CFG = {
  signal:  { label: '⬆ SIGNAL',  labelC: 'rgba(74,180,120,0.95)',  bg: 'rgba(74,180,120,0.055)', border: 'rgba(74,180,120,0.20)',  left: 'rgba(74,180,120,0.75)'  },
  warning: { label: '⚑ WARNING', labelC: 'rgba(220,70,50,0.95)',   bg: 'rgba(220,70,50,0.055)',  border: 'rgba(220,70,50,0.20)',   left: 'rgba(220,70,50,0.75)'   },
  caution: { label: '⚠ CAUTION', labelC: 'rgba(232,168,60,0.95)',  bg: 'rgba(232,168,60,0.055)', border: 'rgba(232,168,60,0.20)',  left: 'rgba(232,168,60,0.75)'  },
  info:    { label: '◈ INSIGHT', labelC: 'rgba(160,185,225,0.90)', bg: 'rgba(160,185,225,0.04)', border: 'rgba(160,185,225,0.15)', left: 'rgba(160,185,225,0.55)' },
};

function InsightBullet({ item }) {
  const cfg = TYPE_CFG[item.type] || TYPE_CFG.info;
  return (
    <div style={{
      padding: '10px 13px 9px', borderRadius: 8,
      background: cfg.bg, border: `0.5px solid ${cfg.border}`,
      borderLeft: `2.5px solid ${cfg.left}`,
      flexShrink: 0,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: cfg.labelC, marginBottom: 5 }}>{cfg.label}</div>
      {item.heading && (
        <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 4 }}>{item.heading}</div>
      )}
      <div style={{ fontFamily: SF, fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.60, fontWeight: 400 }}>{item.body}</div>
    </div>
  );
}

function GraphInsights({ title, insights = [] }) {
  return (
    <div style={{
      background: '#0c0c0e', borderRadius: 10,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxSizing: 'border-box',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ width: 2.5, height: 13, borderRadius: 2, background: 'rgba(232,67,45,0.82)', flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(232,67,45,0.78)', marginBottom: 3 }}>QUICK INSIGHTS</div>
          <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</div>
        </div>
      </div>

      {/* bullets */}
      {insights.length > 0
        ? insights.map((item, i) => <InsightBullet key={i} item={item} />)
        : <div style={{ fontFamily: SF, fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>No insights configured.</div>
      }
    </div>
  );
}

export default GraphInsights;
