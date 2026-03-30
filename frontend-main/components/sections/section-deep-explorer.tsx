// @ts-nocheck
import useChartJs from '@/components/charts/ChartJSWrapper';
import useJsonData from '@/hooks/useJsonData';
import { useLiveSectionData } from '@/hooks/useDashboardData';
import { useState, useEffect } from "react";
import ScatterChart from "../charts/ScatterChart";
import ChannelPlatformHeatmap from "../charts/ChannelHeatmap";
import Ring from "../charts/Ring";
import DonutChart from "../charts/DonutCharts";
import BarRow from "../charts/BarRow";
import KPITree from "../charts/KPITree";
import D3CollapsibleTree from "../charts/D3CollapsibleTree";
import GraphActionButtons from "../ui/GraphActionButtons";
import GraphFlip from "../ui/GraphFlip";
import GraphInsights from "../ui/GraphInsights";
import SectionInfoHint from '@/components/ui/SectionInfoHint';
import { useDash } from '@/lib/contexts';
import { M } from '@/lib/constants';

/* ─────────────────────────────────────────────────────────────
   Advanced KPI — PES · GVI · VVS static data
───────────────────────────────────────────────────────────── */
const VVS_NICHES = ['Gaming','Fitness','Food','Education','Music','Travel','Tech','Beauty','Comedy','Sports'];
const VVS_MEDIANS = { Short:{Pr:0.28,A:0.018,R:0.048}, Medium:{Pr:0.22,A:0.015,R:0.038} };
const VVS_GROUP_R2 = {
  Short: [.41,.48,.52,.44,.39,.46,.43,.50,.38,.42,.46,.51,.49,.45,.41,.44,.47,.48,.40,.45,.50,.54,.53,.47,.43,.45,.48,.51,.58,.46],
  Medium:[.38,.44,.47,.41,.36,.34,.40,.43,.35,.39,.42,.47,.51,.44,.45,.36,.43,.46,.38,.41,.46,.62,.54,.47,.44,.43,.49,.48,.55,.44],
};
const VVS_WEIGHTS = {
  Short:{
    Nano: { Gaming:{a:.195,b:.182,g:.623,r2:.41,n:398},Fitness:{a:.148,b:.167,g:.685,r2:.48,n:434},Food:{a:.149,b:.188,g:.663,r2:.52,n:267},Education:{a:.162,b:.171,g:.667,r2:.44,n:156},Music:{a:.138,b:.171,g:.691,r2:.39,n:274},Travel:{a:.201,b:.158,g:.641,r2:.46,n:281},Tech:{a:.172,b:.169,g:.659,r2:.43,n:310},Beauty:{a:.155,b:.174,g:.671,r2:.50,n:250},Comedy:{a:.158,b:.179,g:.663,r2:.38,n:110},Sports:{a:.163,b:.175,g:.662,r2:.42,n:440} },
    Mid:  { Gaming:{a:.182,b:.175,g:.643,r2:.46,n:127},Fitness:{a:.141,b:.169,g:.690,r2:.51,n:355},Food:{a:.155,b:.176,g:.669,r2:.49,n:131},Education:{a:.165,b:.172,g:.663,r2:.45,n:124},Music:{a:.144,b:.171,g:.685,r2:.41,n:200},Travel:{a:.191,b:.161,g:.648,r2:.44,n:98}, Tech:{a:.168,b:.172,g:.660,r2:.47,n:157},Beauty:{a:.158,b:.173,g:.669,r2:.48,n:180},Comedy:{a:.161,b:.177,g:.662,r2:.40,n:197},Sports:{a:.157,b:.170,g:.673,r2:.45,n:238} },
    Macro:{ Gaming:{a:.178,b:.174,g:.648,r2:.50,n:233},Fitness:{a:.136,b:.166,g:.698,r2:.54,n:223},Food:{a:.151,b:.180,g:.669,r2:.53,n:272},Education:{a:.160,b:.170,g:.670,r2:.47,n:165},Music:{a:.140,b:.169,g:.691,r2:.43,n:258},Travel:{a:.188,b:.158,g:.654,r2:.45,n:176},Tech:{a:.164,b:.170,g:.666,r2:.48,n:212},Beauty:{a:.152,b:.172,g:.676,r2:.51,n:229},Comedy:{a:.125,b:.082,g:.794,r2:.58,n:604},Sports:{a:.152,b:.168,g:.680,r2:.46,n:373} },
  },
  Medium:{
    Nano: { Gaming:{a:.211,b:.165,g:.624,r2:.38,n:170},Fitness:{a:.168,b:.158,g:.674,r2:.44,n:111},Food:{a:.178,b:.172,g:.650,r2:.47,n:271},Education:{a:.189,b:.164,g:.647,r2:.41,n:61}, Music:{a:.155,b:.162,g:.683,r2:.36,n:209},Travel:{a:.377,b:.138,g:.485,r2:.34,n:65}, Tech:{a:.192,b:.165,g:.643,r2:.40,n:104},Beauty:{a:.174,b:.166,g:.660,r2:.43,n:90}, Comedy:{a:.195,b:.168,g:.637,r2:.35,n:35}, Sports:{a:.186,b:.162,g:.652,r2:.39,n:63}  },
    Mid:  { Gaming:{a:.198,b:.162,g:.640,r2:.42,n:86}, Fitness:{a:.156,b:.155,g:.689,r2:.47,n:91}, Food:{a:.165,b:.168,g:.667,r2:.51,n:159},Education:{a:.177,b:.161,g:.662,r2:.44,n:103},Music:{a:.144,b:.142,g:.714,r2:.45,n:163},Travel:{a:.312,b:.142,g:.546,r2:.36,n:27}, Tech:{a:.144,b:.142,g:.713,r2:.43,n:96}, Beauty:{a:.172,b:.163,g:.665,r2:.46,n:93}, Comedy:{a:.185,b:.164,g:.651,r2:.38,n:47}, Sports:{a:.179,b:.158,g:.663,r2:.41,n:93}  },
    Macro:{ Gaming:{a:.192,b:.161,g:.647,r2:.46,n:170},Fitness:{a:.067,b:.096,g:.837,r2:.62,n:87}, Food:{a:.161,b:.166,g:.673,r2:.54,n:449},Education:{a:.172,b:.159,g:.669,r2:.47,n:137},Music:{a:.138,b:.139,g:.723,r2:.44,n:191},Travel:{a:.202,b:.154,g:.644,r2:.43,n:153},Tech:{a:.151,b:.146,g:.703,r2:.49,n:263},Beauty:{a:.165,b:.159,g:.676,r2:.48,n:147},Comedy:{a:.179,b:.082,g:.739,r2:.55,n:565},Sports:{a:.170,b:.154,g:.676,r2:.44,n:103} },
  },
};

/* ─────────────────────────────────────────────────────────────
   Advanced KPI — shared design tokens (Frammer AI single-accent)
───────────────────────────────────────────────────────────── */
const _R    = 'rgba(232,67,45,0.95)';
const _RM   = 'rgba(232,67,45,0.60)';
const _RBG  = 'rgba(232,67,45,0.08)';
const _RBD  = 'rgba(232,67,45,0.22)';
const _INK  = 'rgba(255,255,255,0.90)';
const _INK2 = 'rgba(255,255,255,0.62)';
const _INK3 = 'rgba(255,255,255,0.38)';
const _INK4 = 'rgba(255,255,255,0.20)';
const _LINE = 'rgba(255,255,255,0.08)';
const _LINE2= 'rgba(255,255,255,0.14)';
const _CARD = 'rgba(255,255,255,0.03)';
const _CARD2= 'rgba(255,255,255,0.055)';
const _MN   = 'var(--font-mono)';
const _SN   = 'var(--font-sans)';
// status: good → white  mid → dim white  bad → Frammer red
const _sc   = (v, good, ok) => v >= good ? _INK : v >= ok ? _INK2 : _R;

/* shared sub-components */
function _Divider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'22px 0 16px' }}>
      <div style={{ flex:1, height:'0.5px', background:_LINE }} />
      <span style={{ fontFamily:_MN, fontSize:12, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:_INK4 }}>{label}</span>
      <div style={{ flex:1, height:'0.5px', background:_LINE }} />
    </div>
  );
}
function _FormulaRow({ label, text }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:16, background:_CARD, border:`0.5px solid ${_LINE}`, borderLeft:`2.5px solid ${_R}`, borderRadius:'0 8px 8px 0', padding:'12px 18px', marginBottom:8 }}>
      <span style={{ fontFamily:_MN, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.12em', color:_RM, fontWeight:700, minWidth:72, flexShrink:0, paddingTop:2 }}>{label}</span>
      <span style={{ fontFamily:_MN, fontSize:14, color:_INK2, fontWeight:500, lineHeight:1.55 }}>{text}</span>
    </div>
  );
}
function _SimSlider({ label, min, max, step, val, set, fmt }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12, padding:'10px 16px', background:_CARD, borderRadius:8, border:`0.5px solid ${_LINE}` }}
      onMouseEnter={e => e.currentTarget.style.borderColor = _LINE2}
      onMouseLeave={e => e.currentTarget.style.borderColor = _LINE}>
      <label style={{ fontFamily:_MN, fontSize:14.5, fontWeight:500, color:_INK3, minWidth:168 }}>{label}</label>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(+e.target.value)}
        style={{ flex:1, height:3, accentColor:_R, cursor:'pointer' }} />
      <span style={{ fontFamily:_MN, fontSize:17, fontWeight:700, color:_INK, minWidth:72, textAlign:'right' }}>{fmt(val)}</span>
    </div>
  );
}
function _GaugeRow({ items }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${items.length},1fr)`, gap:10, marginTop:16 }}>
      {items.map((g,i) => (
        <div key={i} style={{ background:_CARD2, border:`0.5px solid ${_LINE}`, borderTop:`1.5px solid ${_RBD}`, borderRadius:10, padding:'16px 18px', textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', bottom:-12, left:'50%', transform:'translateX(-50%)', width:56, height:56, borderRadius:'50%', background:_R, filter:'blur(22px)', opacity:0.10 }} />
          <div style={{ fontFamily:_MN, fontSize:36, lineHeight:1, marginBottom:8, color:_INK, fontWeight:700, letterSpacing:'-0.02em' }}>{g.val}</div>
          <div style={{ height:3, background:_LINE, borderRadius:2, margin:'0 0 10px', overflow:'hidden' }}>
            <div style={{ height:3, borderRadius:2, background:_R, width:Math.min(100,g.barW)+'%', opacity:0.80, transition:'width .4s ease' }} />
          </div>
          <div style={{ fontFamily:_MN, fontSize:12.5, color:_INK3, lineHeight:1.4, textTransform:'uppercase', letterSpacing:'0.06em' }}>{g.label}</div>
        </div>
      ))}
    </div>
  );
}
function _KpiCard({ label, value, sub, hero, heroDesc, heroScore }) {
  return (
    <div style={{ background:_CARD2, border:`0.5px solid ${_LINE}`, borderTop:`1.5px solid ${_RBD}`, borderRadius:12, padding:hero?'20px 24px':'18px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${_RBD},transparent)` }} />
      <div style={{ fontFamily:_MN, fontSize:11.5, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:_INK4, marginBottom:10 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:hero?6:4 }}>
        <div style={{ fontFamily:_MN, fontSize:hero?48:28, fontWeight:700, lineHeight:1, color:_INK, letterSpacing:'-0.02em', transition:'color .3s' }}>{value}</div>
        {hero && <div style={{ fontFamily:_MN, fontSize:16, color:_INK4 }}>/100</div>}
      </div>
      {heroDesc && <div style={{ fontFamily:_SN, fontSize:13.5, color:_INK3, lineHeight:1.65, marginBottom:12, maxWidth:300 }}>{heroDesc}</div>}
      {heroScore !== undefined && (
        <div style={{ height:2, background:_LINE, borderRadius:1, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:1, width:heroScore+'%', background:_R, transition:'width .5s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      )}
      {sub && <div style={{ fontFamily:_MN, fontSize:12.5, color:_INK3, marginTop:2 }}>{sub}</div>}
    </div>
  );
}
function _ExCard({ title, body, resultVal, resultLabel, note }) {
  return (
    <div style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderTop:`1.5px solid ${_RBD}`, borderRadius:12, padding:'20px 22px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, right:0, width:80, height:80, borderRadius:'50%', background:_R, filter:'blur(40px)', opacity:0.06, pointerEvents:'none' }} />
      <div style={{ fontFamily:_MN, fontSize:12.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.10em', color:_INK4, marginBottom:10 }}>{title}</div>
      <div style={{ fontFamily:_SN, fontSize:14, color:_INK2, lineHeight:1.7, marginBottom:14 }} dangerouslySetInnerHTML={{ __html: body }} />
      <div style={{ fontFamily:_MN, fontSize:13.5, color:_INK3, marginBottom:6 }}>{resultLabel}</div>
      <div style={{ fontFamily:_MN, fontSize:32, fontWeight:700, color:_INK, letterSpacing:'-0.02em', marginBottom:10 }}>{resultVal}</div>
      <div style={{ fontFamily:_SN, fontSize:14, color:_INK3, lineHeight:1.6 }}>{note}</div>
    </div>
  );
}
function _StatusBadge({ label, ok }) {
  return (
    <span style={{ fontFamily:_MN, fontSize:11.5, fontWeight:700, padding:'2px 10px', borderRadius:20, letterSpacing:'0.06em',
      background: ok ? _CARD2 : _RBG,
      color: ok ? _INK3 : _R,
      border: `1px solid ${ok ? _LINE2 : _RBD}` }}>{label}</span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Advanced KPI — Content Yield Index
───────────────────────────────────────────────────────────── */
const CYI_IDEAL = { A: 8.0,     R_pub: 0.08,   L_in: 30,    L_out: 15,   P_view: 0.075  };
const CYI_BASE  = { A: 3.3497,  R_pub: 0.0074,  L_in: 10.88, L_out: 5.45, P_view: 0.00323 };
const CYI_MINS  = { A: 1,       R_pub: 0.001,   L_in: 1,     L_out: 0.5,  P_view: 0.001  };
const CYI_STEPS = { A: 0.05,    R_pub: 0.001,   L_in: 0.5,   L_out: 0.25, P_view: 0.001  };
const CYI_KEYS  = ['A', 'R_pub', 'L_in', 'L_out', 'P_view'];
const CYI_META  = {
  A:     { name: 'A — Amplification',    desc: 'AI outputs created per uploaded video',              impLbl: 'Medium',   rank: 4, fv: v => (+v).toFixed(2)+'×',       fb: v => (+v).toFixed(1),          idealNote: '8× amplification — each upload yields 8 distinct clips. Requires long-form, well-structured source content.' },
  R_pub: { name: 'R_pub — Publish Rate', desc: '% of created clips that get published',              impLbl: 'Critical', rank: 1, fv: v => ((+v)*100).toFixed(2)+'%', fb: v => ((+v)*100).toFixed(1)+'%', idealNote: '8% publish rate — the budget-constrained optimizer target. Raising from 0.74% → 8% is the single highest-ROI action.' },
  L_in:  { name: 'L_in — Input Length',  desc: 'Average upload duration in minutes',                impLbl: 'Low',      rank: 5, fv: v => (+v).toFixed(1)+' min',     fb: v => (+v).toFixed(0),          idealNote: '30 min avg input — longer source content yields more extractable moments and a higher amplification ceiling.' },
  L_out: { name: 'L_out — Output Length',desc: 'Average published clip duration in minutes',        impLbl: 'Low',      rank: 6, fv: v => (+v).toFixed(1)+' min',     fb: v => (+v).toFixed(0),          idealNote: '15 min avg output — longer clips carry more watch-time value per publish. Best suited for YouTube long-form.' },
  P_view:{ name: 'P_view — Retention',   desc: 'Published hours ÷ created hours (reach efficiency)',impLbl: 'Critical', rank: 2, fv: v => ((+v)*100).toFixed(3)+'%', fb: v => ((+v)*100).toFixed(2)+'%', idealNote: '7.5% retention — the optimizer target. Currently at 0.32%, the second biggest value leak after R_pub.' },
};
function _cyiRaw(v) { return v.A * v.R_pub * v.L_in * v.L_out * v.P_view; }
const _CYI_VI = _cyiRaw(CYI_IDEAL);
const _CYI_VM = CYI_MINS.A * CYI_MINS.R_pub * CYI_MINS.L_in * CYI_MINS.L_out * CYI_MINS.P_view;
const _CYI_LI = Math.log(_CYI_VI), _CYI_LM = Math.log(_CYI_VM);
const _CYI_VB = _cyiRaw(CYI_BASE);
function _cyiScore(v) {
  return Math.min(100, Math.max(0, Math.round(
    (Math.log(Math.max(_cyiRaw(v), 1e-20)) - _CYI_LM) / (_CYI_LI - _CYI_LM) * 100
  )));
}
const _CYI_RR = { A:[2.5,6], R_pub:[0.04,0.12], L_in:[8,25], L_out:[3,15], P_view:[0.02,0.08] };
function _cyiConf(v) {
  let s = 0;
  CYI_KEYS.forEach(k => {
    const [lo, hi] = _CYI_RR[k], x = v[k];
    if (x >= lo && x <= hi) s += 1;
    else if (x < lo) s += Math.max(0, 1 - (lo - x) / lo * 2.5);
    else s += Math.max(0, 1 - (x - hi) / hi * 2);
  });
  return Math.round(s / CYI_KEYS.length * 100);
}
function _cyiDesc(k, val) {
  const m = CYI_META[k], p = val / CYI_IDEAL[k] * 100;
  if (p >= 95) return m.idealNote;
  if (Math.abs(val - CYI_BASE[k]) / (CYI_BASE[k] || 1) < 0.05) return `At operational baseline (${m.fb(CYI_BASE[k])}). Any improvement here multiplies CYI proportionally.`;
  if (val < CYI_BASE[k]) return `Below operational baseline (${m.fb(CYI_BASE[k])}). Currently underperforming — impact compounds across all factors.`;
  return `${Math.round(p)}% of ideal (${m.fv(CYI_IDEAL[k])}). Good progress — each gain multiplies with all other parameters for compounding CYI lift.`;
}
function _cyiFmtMult(m) {
  if (m >= 10000) return Math.round(m/1000)+'k×';
  if (m >= 1000)  return (m/1000).toFixed(1)+'k×';
  if (m >= 10)    return Math.round(m)+'×';
  return m.toFixed(1)+'×';
}

function CYIPanel() {
  const [cur, setCur]           = useState({ ...CYI_IDEAL });
  const [activeKey, setActiveKey] = useState("R_pub");

  const s       = _cyiScore(cur);
  const conf    = _cyiConf(cur);
  const mult    = _cyiRaw(cur) / _CYI_VB;
  const diffPct = (mult - 1) * 100;
  const biggestGap = CYI_KEYS.reduce((best, k) =>
    (1 - cur[k]/CYI_IDEAL[k]) > (1 - cur[best]/CYI_IDEAL[best]) ? k : best, "R_pub"
  );

  const CG = 'rgba(255,255,255,0.04)', CT = 'rgba(155,155,165,0.75)';
  const TT = { backgroundColor:'#111114', titleColor:'#f2f2f3', bodyColor:'#a8a8b0', borderColor:_LINE, borderWidth:1, padding:10, cornerRadius:8 };

  const sensConfig = (() => {
    const k = activeKey, lo = CYI_MINS[k], hi = CYI_IDEAL[k], pts = 60;
    const xs = [], ys = [];
    for (let i = 0; i <= pts; i++) { const v = lo+i*(hi-lo)/pts; xs.push(v); ys.push(_cyiScore({...cur,[k]:v})); }
    const ci = Math.round((cur[k]-lo)/(hi-lo)*pts);
    const bi = Math.round((Math.max(lo,Math.min(hi,CYI_BASE[k]))-lo)/(hi-lo)*pts);
    const cs = _cyiScore(cur);
    const mk = CYI_META[k];
    const fX = v => (k==='R_pub'||k==='P_view') ? ((+v)*100).toFixed(1)+'%' : (+v).toFixed(1);
    return {
      type:'line',
      data:{ labels:xs.map(fX), datasets:[
        { data:ys, borderColor:_R, borderWidth:2, pointRadius:0, fill:true, backgroundColor:'rgba(232,67,45,0.10)', tension:0.4 },
        { data:xs.map((_,i)=>i===ci?cs:null), borderColor:_INK, pointRadius:7, pointBackgroundColor:'#0a0a0b', pointBorderColor:_R, pointBorderWidth:2, showLine:false, spanGaps:false },
        { data:xs.map((_,i)=>i===bi?_cyiScore({...cur,[k]:CYI_BASE[k]}):null), borderColor:_INK4, pointRadius:5, pointBackgroundColor:_INK4, showLine:false, spanGaps:false },
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:ctx=>ctx.datasetIndex===0?'CYI: '+Math.round(ctx.parsed.y)+'/100':ctx.datasetIndex===1?'Current: '+mk.fv(cur[k]):'Baseline: '+mk.fv(CYI_BASE[k])}} },
        scales:{ x:{ticks:{maxTicksLimit:7,color:CT,font:{size:10,family:_MN}},grid:{color:CG}}, y:{min:0,max:100,ticks:{color:CT,font:{size:10,family:_MN},stepSize:25,callback:v=>v+'/100'},grid:{color:CG}} }
      }
    };
  })();

  const distConfig = (() => {
    const dv = CYI_KEYS.map(k => +Math.min(100, cur[k]/CYI_IDEAL[k]*100).toFixed(1));
    return {
      type:'bar',
      data:{ labels:CYI_KEYS, datasets:[
        { data:dv, backgroundColor:'rgba(232,67,45,0.70)', borderRadius:5, borderSkipped:false },
        { data:CYI_KEYS.map(()=>100), backgroundColor:'rgba(255,255,255,0.04)', borderRadius:5, borderSkipped:false, borderColor:'rgba(255,255,255,0.06)', borderWidth:1 },
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:ctx=>ctx.datasetIndex===0?ctx.parsed.y+'% of ideal':'Ideal = 100%'}} },
        scales:{ x:{ticks:{color:CT,font:{size:11,family:_MN}},grid:{display:false}}, y:{min:0,max:110,ticks:{color:CT,font:{size:10,family:_MN},stepSize:25,callback:v=>v+'%'},grid:{color:CG}} }
      }
    };
  })();

  const sensRef = useChartJs("cyi-sens", sensConfig, [cur.A, cur.R_pub, cur.L_in, cur.L_out, cur.P_view, activeKey]);
  const distRef = useChartJs("cyi-dist", distConfig,  [cur.A, cur.R_pub, cur.L_in, cur.L_out, cur.P_view]);

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:_MN, fontSize:12, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:_RM, marginBottom:8 }}>Dataset 5 · 5-Factor Multiplicative Model</div>
          <div style={{ fontFamily:_MN, fontSize:30, fontWeight:700, color:_INK, letterSpacing:'-0.01em', lineHeight:1.1, marginBottom:10 }}>Content Yield Index</div>
          <div style={{ fontFamily:_SN, fontSize:14.5, color:_INK2, lineHeight:1.70, maxWidth:580 }}>How efficiently does your platform convert uploaded content into distributed, watched audience output? 100 = all 5 parameters at data-derived optimal.</div>
        </div>
      </div>

      {/* Formula */}
      <_FormulaRow label="Formula"   text="CYI  =  A  ×  R_pub  ×  L_in  ×  L_out  ×  P_view" />
      <_FormulaRow label="Interpret" text="Multiplicative — every parameter compounds. Lifting R_pub from 0.74% → 8% alone multiplies CYI by ~10×." />

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:10, marginTop:20, marginBottom:20 }}>
        <_KpiCard label="Content Yield Index (CYI)" value={s} hero heroScore={s}
          heroDesc="Converts uploaded content into distributed, watched output — creation through publishing to reach." />
        <_KpiCard label="VS Baseline" value={_cyiFmtMult(mult)}
          sub={diffPct>0?`+${diffPct.toFixed(0)}% vs current ops`:diffPct<-0.5?`${diffPct.toFixed(0)}% vs current ops`:'at baseline level'} />
        <_KpiCard label="Confidence" value={conf+'/100'}
          sub={conf>=75?'Achievable targets':conf>=50?'Stretch targets':'Theoretical ceiling'} />
        <_KpiCard label="Biggest Gap" value={biggestGap}
          sub={`${CYI_META[biggestGap].impLbl} importance — #${CYI_META[biggestGap].rank} of 5`} />
      </div>

      {/* Explanation */}
      <div style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderLeft:`2.5px solid ${_R}`, borderRadius:'0 8px 8px 0', padding:'12px 18px', marginBottom:4, transition:'border-left-color .25s' }}>
        <div style={{ fontFamily:_MN, fontSize:11.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:_RM, marginBottom:5 }}>Active factor · {CYI_META[activeKey].name}</div>
        <div style={{ fontFamily:_SN, fontSize:14.5, color:_INK2, lineHeight:1.65 }}>{_cyiDesc(activeKey, cur[activeKey])}</div>
      </div>

      <_Divider label="Parameter Controls" />

      {/* Sliders grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:4 }}>
        {CYI_KEYS.map(k => {
          const m   = CYI_META[k];
          const lo  = CYI_MINS[k], hi = CYI_IDEAL[k];
          const bp  = Math.max(2, Math.min(98, (CYI_BASE[k]-lo)/(hi-lo)*100));
          const pi  = Math.min(100, cur[k]/hi*100);
          const isAct = k === activeKey;
          return (
            <div key={k} onClick={() => setActiveKey(k)}
              style={{ background:isAct?'rgba(232,67,45,0.06)':_CARD, border:`0.5px solid ${isAct?_RBD:_LINE}`, borderLeft:isAct?`2.5px solid ${_R}`:`2.5px solid transparent`, borderRadius:10, padding:'16px 18px', cursor:'pointer', transition:'all .15s' }}
              onMouseEnter={e => { if (!isAct) { e.currentTarget.style.borderColor = _LINE2; e.currentTarget.style.background = _CARD2; }}}
              onMouseLeave={e => { if (!isAct) { e.currentTarget.style.borderColor = _LINE; e.currentTarget.style.background = _CARD; }}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:8 }}>
                <span style={{ fontFamily:_SN, fontSize:14, fontWeight:600, color:_INK, letterSpacing:'-0.2px' }}>{m.name}</span>
                <span style={{ fontFamily:_MN, fontSize:14, fontWeight:700, color:isAct?_INK:_INK2, flexShrink:0 }}>{m.fv(cur[k])}</span>
              </div>
              <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                <_StatusBadge label={m.impLbl==='Critical'?'Critical — bottleneck':m.impLbl==='Medium'?'Medium importance':'Low — multiplier'} ok={m.impLbl==='Low'} />
                <span style={{ fontFamily:_MN, fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:20, background:_CARD2, color:_INK4, border:`1px solid ${_LINE}` }}>#{m.rank} of 5</span>
              </div>
              <div style={{ fontFamily:_SN, fontSize:13.5, color:_INK3, marginBottom:12, lineHeight:1.5 }}>{m.desc}</div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontFamily:_MN, fontSize:11.5, color:_INK4 }}>{m.fb(lo)}</span>
                <span style={{ fontFamily:_MN, fontSize:11.5, fontWeight:600, color:_RM }}>{m.fv(hi)} ideal</span>
              </div>
              <input type="range" min={lo} max={hi} step={CYI_STEPS[k]} value={cur[k]}
                onFocus={() => setActiveKey(k)}
                onChange={e => { setActiveKey(k); setCur(prev => ({...prev,[k]:+e.target.value})); }}
                style={{ width:'100%', height:3, accentColor:_R, cursor:'pointer', display:'block', marginBottom:2 }} />
              <div style={{ position:'relative', height:14, marginTop:2, marginBottom:8 }}>
                <div style={{ position:'absolute', left:bp+'%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:1, height:5, background:_INK4, opacity:0.6 }} />
                  <span style={{ fontFamily:_MN, fontSize:10.5, color:_INK4, whiteSpace:'nowrap', marginTop:1 }}>baseline {m.fb(CYI_BASE[k])}</span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ fontFamily:_MN, fontSize:11.5, color:_INK4, minWidth:56 }}>% of ideal</span>
                <div style={{ flex:1, height:3, background:_LINE, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:3, borderRadius:2, background:_R, width:pi+'%', opacity:0.80, transition:'width .3s' }} />
                </div>
                <span style={{ fontFamily:_MN, fontSize:11.5, minWidth:52, textAlign:'right', color:_sc(pi,90,60), fontWeight:600 }}>{pi.toFixed(0)}%</span>
              </div>
              <div style={{ fontFamily:_SN, fontSize:13, color:_INK4, lineHeight:1.6, padding:'8px 11px', background:'rgba(0,0,0,0.20)', borderRadius:7, border:`0.5px solid ${_LINE}`, minHeight:36 }}>
                {_cyiDesc(k, cur[k]).length>140?_cyiDesc(k, cur[k]).slice(0,140)+'…':_cyiDesc(k, cur[k])}
              </div>
            </div>
          );
        })}
      </div>

      <_Divider label="Analysis" />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderRadius:12, padding:'18px 20px' }}>
          <div style={{ fontFamily:_MN, fontSize:11.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:_INK4, marginBottom:3 }}>Sensitivity Analysis</div>
          <div style={{ fontFamily:_SN, fontSize:14, color:_INK3, marginBottom:14 }}>CYI score across the {activeKey} range</div>
          <div style={{ position:'relative', height:190 }}><canvas ref={sensRef} /></div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:10 }}>
            {[{bg:_R,label:'CYI /100'},{bg:_INK,label:'Current'},{bg:_INK4,label:'Baseline'}].map((li,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:_MN, fontSize:11.5, color:_INK3 }}>
                <div style={{ width:7, height:7, borderRadius:2, background:li.bg }} />{li.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderRadius:12, padding:'18px 20px' }}>
          <div style={{ fontFamily:_MN, fontSize:11.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:_INK4, marginBottom:3 }}>Distance from Ideal</div>
          <div style={{ fontFamily:_SN, fontSize:14, color:_INK3, marginBottom:14 }}>Each factor's proximity to its data-derived optimum</div>
          <div style={{ position:'relative', height:190 }}><canvas ref={distRef} /></div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Advanced KPI — all 4 sub-tabs
───────────────────────────────────────────────────────────── */
function AdvancedKPITab({ onAskAI, kpiTab, setKpiTab }) {
  const [pesCpw, setPesCpw] = useState(3.15);
  const [pesAvg, setPesAvg] = useState(3.15);
  const [gviCpw, setGviCpw] = useState(2.0);
  const [gviBudget, setGviBudget] = useState(1000);

  // VVS state
  const [vvsSize, setVvsSize] = useState("Mid");
  const [vvsNiche, setVvsNiche] = useState("Gaming");
  const [vvsFmt, setVvsFmt] = useState("Short");
  const [vvsPr, setVvsPr] = useState(30);
  const [vvsA, setVvsA] = useState(20);
  const [vvsR, setVvsR] = useState(50);
  const [vvsNicheView, setVvsNicheView] = useState("Short");

  const MARKET_AVG = 3.15;
  const GEO_AVG    = 2.0;

  // PES
  const pes     = pesAvg / pesCpw;
  const pesWph  = 1 / pesCpw;
  const pesSave = Math.max(0, (pesAvg - pesCpw) * 100 / pesAvg);
  const pesVerdict = pes >= 2 ? `Excellent — PES ${pes.toFixed(2)}. Buying at ${((1/pes)*100).toFixed(0)}% of market rate. Strong ROI.`
    : pes >= 1.2 ? `Good — PES ${pes.toFixed(2)}. Slightly below market rate. Solid efficiency.`
    : pes >= 0.85 ? `Average — PES ${pes.toFixed(2)}. Near market average. No significant advantage.`
    : `Premium — PES ${pes.toFixed(2)}. Paying ${((1/pes-1)*100).toFixed(0)}% above market. Justify with audience quality.`;
  const pesC = _sc(pes, 1.5, 0.85);

  // GVI
  const gvi      = (GEO_AVG / gviCpw) * 100;
  const gviHours = gviBudget / gviCpw;
  const gviImpr  = (gviBudget / gviCpw) * 60 * 3 / 1000;
  const gviVerdict = gvi >= 300 ? `High-reach — GVI ${Math.round(gvi)}. Your $${gviBudget.toLocaleString()} buys ${Math.round(gviHours).toLocaleString()} watch hours, ${(gvi/100).toFixed(1)}× the global average.`
    : gvi >= 150 ? `Good value — GVI ${Math.round(gvi)}. Above-average reach for your budget.`
    : gvi >= 70  ? `Near global average — GVI ${Math.round(gvi)}. Typical cost for this market.`
    : `Premium market — GVI ${Math.round(gvi)}. Low reach per dollar. Audience quality must justify the spend.`;
  const gviC = _sc(gvi, 200, 70);

  // VVS
  const vvsW          = (VVS_WEIGHTS[vvsFmt]?.[vvsSize]?.[vvsNiche]) || { a:0.17, b:0.17, g:0.66 };
  const vvsMed        = VVS_MEDIANS[vvsFmt] || VVS_MEDIANS.Short;
  const vvsScore      = Math.pow(vvsPr/100, vvsW.a) * Math.pow(vvsA/100, vvsW.b) * Math.pow(vvsR/100, vvsW.g);
  const vvsMedianScore= Math.pow(vvsMed.Pr, vvsW.a) * Math.pow(vvsMed.A, vvsW.b) * Math.pow(vvsMed.R, vvsW.g);
  const vvsNorm       = Math.min(100, Math.round((vvsScore/vvsMedianScore)*50));
  const vvsConfScore  = (() => {
    const r2=vvsW.r2||0.45, n=vvsW.n||100;
    return Math.round(( r2*0.45 + Math.min(1,n/200)*0.30 + ((vvsPr>1?0.4:0)+(vvsA>1?0.35:0)+(vvsR>5?0.25:0))*0.25 )*100);
  })();
  const vvsC      = _sc(vvsNorm, 70, 40);
  const vvsConfC  = _sc(vvsConfScore, 70, 45);
  const vvsConfLbl= vvsConfScore>=70?'HIGH CONFIDENCE':vvsConfScore>=45?'MODERATE':'LOW CONFIDENCE';

  const pesPlatforms = [{p:"YouTube Shorts",cpw:5.0},{p:"Instagram Reels",cpw:6.0},{p:"Facebook Reels",cpw:6.0},{p:"X / Twitter",cpw:7.0},{p:"Threads",cpw:6.0},{p:"LinkedIn",cpw:12.0}].sort((a,b)=>a.cpw-b.cpw);
  const gviConts     = [{c:"North America",cpw:6.72},{c:"Europe",cpw:4.8},{c:"Oceania",cpw:7.68},{c:"East Asia",cpw:3.84},{c:"Middle East",cpw:2.4},{c:"Latin America",cpw:1.2},{c:"South Asia",cpw:0.58},{c:"Africa",cpw:1.2}].sort((a,b)=>b.cpw-a.cpw);

  const TH = { fontFamily:_MN, fontSize:12.5, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', padding:'10px 16px', color:_INK4, borderBottom:`0.5px solid ${_LINE}`, textAlign:'left' as const, background:'rgba(255,255,255,0.02)' };
  const TD = { padding:'11px 16px', borderBottom:`0.5px solid rgba(255,255,255,0.04)`, fontFamily:_SN, fontSize:15, color:_INK2 };

  const TABS = [
    { k:"vvs", label:"Viral Velocity Score"      },
    { k:"cyi", label:"Content Yield Index"       },
    { k:"pes", label:"Platform Efficiency Score" },
    { k:"gvi", label:"Geo Value Index"           },
  ];

  return (
    <div className="stack">
      {/* ── Tab strip ── */}
      <div style={{ display:'flex', gap:0, background:_CARD, borderRadius:10, border:`0.5px solid ${_LINE}`, width:'fit-content', overflow:'hidden' }}>
        {TABS.map(({ k, label }, idx) => (
          <button key={k} onClick={() => setKpiTab(k)} style={{
            padding:'10px 24px',
            fontFamily:_MN, fontSize:13.5, fontWeight:700,
            letterSpacing:'0.08em', textTransform:'uppercase',
            border:'none', borderRight: idx < TABS.length-1 ? `0.5px solid ${_LINE}` : 'none',
            cursor:'pointer',
            background: kpiTab===k ? _RBG : 'transparent',
            color: kpiTab===k ? _R : _INK3,
            transition:'all 0.15s ease',
            position:'relative',
          }}>
            {kpiTab===k && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:_R }} />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Panel ── */}
      <div className="card" style={{ padding:0, overflow:'hidden', border:`0.5px solid ${_LINE}` }}>
        <div style={{ height:2, background:`linear-gradient(90deg,${_R},rgba(232,67,45,0.35),transparent)` }} />

        <div style={{ padding:'28px 32px' }}>

          {/* ══ CYI ══ */}
          {kpiTab === "cyi" && <CYIPanel />}

          {/* ══ VVS ══ */}
          {kpiTab === "vvs" && <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:_MN, fontSize:12, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:_RM, marginBottom:8 }}>Dataset 3 · 60 Niche × Account-Size Combinations · Power-Law Model</div>
                <div style={{ fontFamily:_MN, fontSize:30, fontWeight:700, color:_INK, marginBottom:10, letterSpacing:'-0.01em', lineHeight:1.1 }}>Viral Velocity Score</div>
                <div style={{ fontFamily:_SN, fontSize:14.5, color:_INK2, lineHeight:1.70, maxWidth:580 }}>Predicts a video's viral probability using a power-law model fitted separately for each niche × account-size group. Weights derived from 60 regression fits across Short and Medium formats.</div>
              </div>
            </div>

            <_FormulaRow label="Formula"   text="VVS = Pr^α × A^β × R^γ   (power-law, group-fitted weights)" />
            <_FormulaRow label="Weights"   text={`α=${vvsW.a?.toFixed(3)} (prompt rate)  ·  β=${vvsW.b?.toFixed(3)} (avg views)  ·  γ=${vvsW.g?.toFixed(3)} (retention)`} />
            <_FormulaRow label="Interpret" text="VVS ≥ 70 → High viral potential  |  40–69 → Moderate  |  < 40 → Low signal" />

            {/* Context selectors */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:20, marginBottom:20 }}>
              {[
                { label:'Account Size', val:vvsSize,  set:setVvsSize,  opts:["Nano","Mid","Macro"] },
                { label:'Niche',        val:vvsNiche, set:setVvsNiche, opts:VVS_NICHES },
                { label:'Format',       val:vvsFmt,   set:setVvsFmt,   opts:["Short","Medium"] },
              ].map(({ label, val, set, opts }) => (
                <div key={label} style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontFamily:_MN, fontSize:11.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:_INK4, marginBottom:10 }}>{label}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {opts.map(o => (
                      <button key={o} onClick={()=>set(o)} style={{
                        padding:'5px 12px', borderRadius:6, border:`0.5px solid ${val===o?_RBD:_LINE}`,
                        fontFamily:_MN, fontSize:13, fontWeight:600, cursor:'pointer',
                        background: val===o ? _RBG : 'transparent',
                        color: val===o ? _R : _INK3,
                        transition:'all .15s',
                      }}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Simulator */}
            <div style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderRadius:12, padding:'22px 24px', marginBottom:22 }}>
              <_Divider label="Try it — VVS Simulator" />
              <_SimSlider label="Prompt Rate Pr (%)"   min={0}   max={100} step={1} val={vvsPr} set={setVvsPr} fmt={v=>v+'%'} />
              <_SimSlider label="Avg Views A (×1000)"  min={0}   max={200} step={1} val={vvsA}  set={setVvsA}  fmt={v=>v+'K'} />
              <_SimSlider label="Retention Rate R (%)" min={0}   max={100} step={1} val={vvsR}  set={setVvsR}  fmt={v=>v+'%'} />
              <_GaugeRow items={[
                { label:'Viral Velocity Score',  val:vvsNorm,                      barW:vvsNorm },
                { label:'Model R² for group',    val:(vvsW.r2||0.45).toFixed(2),   barW:(vvsW.r2||0.45)*100 },
                { label:'Confidence',            val:vvsConfScore+'%',             barW:vvsConfScore },
              ]} />
              <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10, borderRadius:8, padding:'12px 18px', background:_RBG, border:`0.5px solid ${_RBD}` }}>
                <span style={{ fontFamily:_MN, fontSize:12, fontWeight:700, color:vvsConfC, letterSpacing:'0.10em', padding:'3px 10px', background:'rgba(255,255,255,0.05)', borderRadius:5, border:`1px solid ${_LINE2}`, flexShrink:0 }}>{vvsConfLbl}</span>
                <span style={{ fontFamily:_SN, fontSize:14.5, color:_INK2, lineHeight:1.6 }}>
                  {vvsNorm>=70?`Strong viral signal. ${vvsNiche} ${vvsSize} accounts at these metrics exceed the median by ${Math.round(vvsNorm/50*100-100)}%.`
                    :vvsNorm>=40?'Moderate signal. Video shows some viral markers but falls below the top-quartile threshold.'
                    :'Weak signal. Lift Prompt Rate or Retention to push the score above 70.'}
                </span>
              </div>
            </div>

            {/* R² heatmap */}
            <div style={{ marginBottom:22 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <_Divider label="R² Fit Quality by Niche × Account Size" />
                <div style={{ display:'flex', gap:5, marginLeft:16 }}>
                  {["Short","Medium"].map(f=>(
                    <button key={f} onClick={()=>setVvsNicheView(f)} style={{
                      padding:'5px 14px', borderRadius:6, border:`0.5px solid ${vvsNicheView===f?_RBD:_LINE}`,
                      fontFamily:_MN, fontSize:13, fontWeight:600, cursor:'pointer',
                      background:vvsNicheView===f?_RBG:'transparent',
                      color:vvsNicheView===f?_R:_INK3, transition:'all .15s',
                    }}>{f}</button>
                  ))}
                </div>
              </div>
              <div style={{ border:`0.5px solid ${_LINE}`, borderRadius:10, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH}>Niche</th>
                      {["Nano","Mid","Macro"].map(s=><th key={s} style={TH}>{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {VVS_NICHES.map(niche=>(
                      <tr key={niche}
                        style={{ transition:'background .15s', background:(niche===vvsNiche&&vvsFmt===vvsNicheView)?_RBG:'transparent' }}
                        onMouseEnter={e=>e.currentTarget.style.background=_CARD2}
                        onMouseLeave={e=>e.currentTarget.style.background=(niche===vvsNiche&&vvsFmt===vvsNicheView)?_RBG:'transparent'}>
                        <td style={{ ...TD, fontFamily:_SN, fontWeight:500, color:_INK }}>{niche}</td>
                        {["Nano","Mid","Macro"].map(size=>{
                          const w=VVS_WEIGHTS[vvsNicheView]?.[size]?.[niche];
                          const r2=w?.r2||0;
                          const r2opacity = r2>=0.5?0.90:r2>=0.4?0.60:0.30;
                          return (
                            <td key={size} style={{ ...TD, fontFamily:_MN, fontSize:15 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ flex:1, background:_LINE, borderRadius:3, height:5, overflow:'hidden' }}>
                                  <div style={{ height:5, borderRadius:3, background:`rgba(232,67,45,${r2opacity})`, width:(r2*100)+'%' }} />
                                </div>
                                <span style={{ color:`rgba(255,255,255,${r2opacity})`, fontWeight:600, minWidth:34 }}>{r2.toFixed(2)}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <_ExCard title="Model Architecture"
                body="Power-law regression: <strong>VVS = Pr^α × A^β × R^γ</strong><br/>Fitted independently per niche × size group. Log-transformed inputs, OLS on residuals."
                resultLabel="Total observations"
                resultVal="3,450+"
                note="Each group uses its own α, β, γ weights to capture niche-specific engagement dynamics." />
              <_ExCard title="Confidence Composite"
                body="Score = 0.45 × R² + 0.30 × sample_norm + 0.25 × signal_quality<br/>Signal checks: Pr > 1%, A > 1K views, R > 5%"
                resultLabel={`Current group · ${vvsNiche} × ${vvsSize} (${vvsFmt})`}
                resultVal={`R² = ${(vvsW.r2||0.45).toFixed(2)}`}
                note={`${vvsW.n||'—'} observations in this group.`} />
            </div>
          </>}

          {/* ══ PES / GVI ══ */}
          {(kpiTab==="pes"||kpiTab==="gvi") && (() => {
            const isPes = kpiTab === "pes";
            return <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:_MN, fontSize:12, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:_RM, marginBottom:8 }}>
                    {isPes ? 'Dataset 1 · Platform × Topic Ad Cost' : 'Dataset 2 · YouTube Continent × Topic Ad Cost'}
                  </div>
                  <div style={{ fontFamily:_MN, fontSize:30, fontWeight:700, color:_INK, marginBottom:10, letterSpacing:'-0.01em', lineHeight:1.1 }}>
                    {isPes ? 'Platform Efficiency Score' : 'Geo Value Index'}
                  </div>
                  <div style={{ fontFamily:_SN, fontSize:14.5, color:_INK2, lineHeight:1.70, maxWidth:580 }}>
                    {isPes ? "How much watch-time bang do you get per dollar, relative to the market average? A score above 1.0 means you're buying cheaper than the norm."
                           : "Not all cheap markets are equal — this index scores each region by dividing reach per dollar by its market cost tier, revealing where you get high volume and value."}
                  </div>
                </div>
              </div>

              <_FormulaRow label="Formula"   text={isPes ? "PES = Avg CPW (all platforms) ÷ CPW (chosen platform & topic)" : "GVI = (Global avg CPW ÷ Local CPW) × 100"} />
              <_FormulaRow label="Interpret" text={isPes ? "PES > 1.0 → cheaper than average  |  PES = 1.0 → at par  |  PES < 1.0 → paying a premium" : "GVI 100 = at global avg  |  GVI > 100 → above-average reach per $  |  GVI < 100 → premium market"} />

              {/* Example cards */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:20, marginBottom:22 }}>
                {isPes ? <>
                  <_ExCard title="Example A — Budget campaign"
                    body="Running a <strong>Vlogging</strong> ad on <strong>YouTube Shorts</strong>.<br/>CPW = $0.80 · Market avg = $3.15"
                    resultLabel="PES = 3.15 ÷ 0.80" resultVal="3.94×"
                    note="Nearly 4× more efficient than average. Every $1 buys 4 hours of watch time vs 1 hour elsewhere." />
                  <_ExCard title="Example B — Premium campaign"
                    body="Running a <strong>Finance</strong> ad on <strong>LinkedIn</strong>.<br/>CPW = $12.00 · Market avg = $3.15"
                    resultLabel="PES = 3.15 ÷ 12.00" resultVal="0.26×"
                    note="Only 26% as efficient as average. You're paying 4× more per watch hour than the norm." />
                </> : <>
                  <_ExCard title="Example A — Reach campaign"
                    body="Running a <strong>Tech AI</strong> ad in <strong>South Asia</strong>.<br/>Local CPW = $0.36 · Global avg = $2.00"
                    resultLabel="GVI = (2.00 ÷ 0.36) × 100" resultVal="556"
                    note="$100 buys 278 hours of Tech AI watch time here vs just 50 hours globally. Massive reach multiplier." />
                  <_ExCard title="Example B — Quality campaign"
                    body="Running a <strong>Finance</strong> ad in <strong>Oceania</strong>.<br/>Local CPW = $7.68 · Global avg = $2.00"
                    resultLabel="GVI = (2.00 ÷ 7.68) × 100" resultVal="26"
                    note="$100 buys only 13 watch hours vs 50 globally. You're paying for audience quality, not volume." />
                </>}
              </div>

              {/* Simulator */}
              <div style={{ background:_CARD, border:`0.5px solid ${_LINE}`, borderRadius:12, padding:'22px 24px', marginBottom:22 }}>
                <_Divider label={`Try it — ${isPes?'PES':'GVI'} Simulator`} />
                {isPes ? <>
                  <_SimSlider label="Your CPW ($)"       min={0.8}  max={12}    step={0.1}   val={pesCpw}    set={setPesCpw}    fmt={v=>'$'+v.toFixed(2)} />
                  <_SimSlider label="Market avg CPW ($)" min={1}    max={6}     step={0.05}  val={pesAvg}    set={setPesAvg}    fmt={v=>'$'+v.toFixed(2)} />
                  <_GaugeRow items={[
                    { label:'Platform Efficiency Score', val:pes.toFixed(2),         barW:pes/5*100 },
                    { label:'Watch hours per $1 spent',  val:pesWph.toFixed(1)+'h',  barW:pesWph/4*100 },
                    { label:'Savings per $100 vs avg',   val:'$'+pesSave.toFixed(0), barW:pesSave },
                  ]} />
                </> : <>
                  <_SimSlider label="Local CPW ($)" min={0.12} max={7.68}  step={0.01}  val={gviCpw}    set={setGviCpw}    fmt={v=>'$'+v.toFixed(2)} />
                  <_SimSlider label="Budget ($)"    min={100}  max={10000} step={100}   val={gviBudget} set={setGviBudget} fmt={v=>'$'+v.toLocaleString()} />
                  <_GaugeRow items={[
                    { label:'Geo Value Index',    val:Math.round(gvi),       barW:gvi/8 },
                    { label:'Watch hours bought', val:gviHours>=1000?(gviHours/1000).toFixed(1)+'K':Math.round(gviHours)+'h', barW:gviHours/gviBudget*10 },
                    { label:'Est. impressions',   val:gviImpr>=1000?(gviImpr/1000).toFixed(1)+'M':Math.round(gviImpr)+'K',   barW:gviImpr/1000*20 },
                  ]} />
                </>}
                <div style={{ marginTop:14, borderRadius:8, padding:'12px 18px', fontFamily:_SN, fontSize:14, lineHeight:1.65, background:_RBG, color: isPes?pesC:gviC, border:`0.5px solid ${_RBD}`, transition:'color .3s' }}>
                  {isPes ? pesVerdict : gviVerdict}
                </div>
              </div>

              {/* Ranking table */}
              <_Divider label={isPes?'PES Ranking — all platforms, Finance topic':'GVI Ranking — all continents, Finance topic'} />
              <div style={{ border:`0.5px solid ${_LINE}`, borderRadius:10, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {(isPes?['Platform','CPW','PES','Efficiency']:['Continent','CPW','GVI','Watch hrs / $100']).map((h,i,arr)=>(
                        <th key={h} style={{ ...TH, width:i===arr.length-1?(isPes?130:180):'auto' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isPes
                      ? pesPlatforms.map(r=>{
                          const p=(MARKET_AVG/r.cpw).toFixed(2);
                          const isGood = +p >= 1;
                          return (
                            <tr key={r.p} style={{ transition:'background .15s' }}
                              onMouseEnter={e=>e.currentTarget.style.background=_CARD2}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <td style={{ ...TD, color:_INK, fontWeight:500 }}>{r.p}</td>
                              <td style={{ ...TD, fontFamily:_MN, color:_INK3 }}>${r.cpw.toFixed(2)}</td>
                              <td style={{ ...TD, fontFamily:_MN, fontWeight:700, fontSize:16, color: isGood?_INK:_R }}>{p}</td>
                              <td style={TD}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ flex:1, background:_LINE, borderRadius:3, height:5, overflow:'hidden' }}>
                                    <div style={{ height:5, borderRadius:3, background:_R, width:Math.min(100,(+p/5)*100)+'%', opacity:isGood?0.80:0.35 }} />
                                  </div>
                                  <span style={{ fontFamily:_MN, fontSize:13.5, color: isGood?_INK2:_R, minWidth:32, fontWeight:600 }}>{(+p*100/5).toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      : gviConts.map(r=>{
                          const gviR=Math.round((GEO_AVG/r.cpw)*100);
                          const hrs=(100/r.cpw).toFixed(1);
                          const isGood = gviR >= 100;
                          return (
                            <tr key={r.c} style={{ transition:'background .15s' }}
                              onMouseEnter={e=>e.currentTarget.style.background=_CARD2}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <td style={{ ...TD, color:_INK, fontWeight:500 }}>{r.c}</td>
                              <td style={{ ...TD, fontFamily:_MN, color:_INK3 }}>${r.cpw.toFixed(2)}</td>
                              <td style={{ ...TD, fontFamily:_MN, fontWeight:700, fontSize:16, color: isGood?_INK:_R }}>{gviR}</td>
                              <td style={TD}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ flex:1, background:_LINE, borderRadius:3, height:5, overflow:'hidden' }}>
                                    <div style={{ height:5, borderRadius:3, background:_R, width:Math.min(100,gviR/8)+'%', opacity:isGood?0.80:0.35 }} />
                                  </div>
                                  <span style={{ fontFamily:_MN, fontSize:13.5, color:_INK3, minWidth:36, fontWeight:500 }}>{hrs}h</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            </>;
          })()}

        </div>
      </div>
    </div>
  );
}


function SectionExplorer({ theme, onAskAI }) {
  const dash = useDash();
  const { data: staticData } = useJsonData("explorer");
  const data = useLiveSectionData("explorer", dash?.liveDashboard, staticData);
  const [subView, setSubView] = useState("users");
  const [kpiTab, setKpiTab] = useState("vvs");
  const [userSort, setUserSort] = useState("created");

  // Respond to deep-link navigation from other sections (e.g. Executive KPI blocks)
  useEffect(() => {
    const dl = dash?.explorerDeepLink;
    if (!dl) return;
    if (dl.subView) setSubView(dl.subView);
    if (dl.kpiTab) setKpiTab(dl.kpiTab);
    dash?.clearExplorerDeepLink?.();
  }, [dash?.explorerDeepLink]);
  const [treeRoot, setTreeRoot] = useState("channel");
  const [treeChild, setTreeChild] = useState("user");
  const [treeMetric, setTreeMetric] = useState("cr");
  const [insightsOpen, setInsightsOpen] = useState({});
  const USERS = data?.users || [];
  const LANGUAGES = data?.languages || [];
  const toggleInsights = (key) =>
    setInsightsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const unusual = USERS.filter((u) => u.created > 400 && u.published === 0).map(
    (u) => u.user,
  );

  const sortedUsers = [...USERS].sort((a, b) => b[userSort] - a[userSort]);
  const topPublishers = USERS.filter((u) => u.published > 0)
    .sort((a, b) => b.published - a.published)
    .slice(0, 6);
  const channelHeatmapData = (data?.platformHeatmap || []).map((row) => ({
    channel: row.channel,
    platforms: (data?.platformNames || []).reduce((acc, platform, idx) => {
      acc[platform] = row.values[idx];
      return acc;
    }, {}),
  }));
  const dataQualityRows = data?.dataQualityRows || [];
  const TICK_OPT = {
    color: theme === "light" ? "#000000" : "#ffffff",
    font: { size: 10, family: "var(--font-mono)" },
  };
  const GRID_OPT = { color: "var(--chart-grid)" };
  const TT_OPT = {
    backgroundColor:
      theme === "dark" ? "rgba(20,16,10,0.92)" : "rgba(255,252,248,0.96)",
    titleColor: "var(--ink)",
    bodyColor: "var(--ink3)",
    padding: 8,
    cornerRadius: 4,
    borderColor: "var(--line)",
    borderWidth: 1,
  };

  const userBarRef = useChartJs(
    "explorer-userbar",
    {
      type: "bar",
      data: {
        labels: USERS.slice(0, 12).map((u) => u.user.split(" ")[0]),
        datasets: [
          {
            label: "Created",
            data: USERS.slice(0, 12).map((u) => u.created),
            backgroundColor: "rgba(232,38,90,0.55)",
            borderColor: "#e8265a",
            borderWidth: 1,
          },
          {
            label: "Published",
            data: USERS.slice(0, 12).map((u) => u.published),
            backgroundColor: "rgba(48,176,96,0.65)",
            borderColor: "#30b060",
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
          x: { ticks: TICK_OPT, grid: GRID_OPT },
          y: {
            ticks: { ...TICK_OPT, font: { size: 10 } },
            grid: GRID_OPT,
          },
        },
      },
    },
    [theme, USERS],
  );

  const paretoRef = useChartJs(
    "explorer-pareto",
    {
      type: "bar",
      data: (() => {
        const sorted = [...USERS].sort((a, b) => b.created - a.created);
        const total = sorted.reduce((s, u) => s + u.created, 0);
        let cum = 0;
        const cumPct = sorted.map((u) => {
          cum += u.created;
          return +((cum / total) * 100).toFixed(1);
        });
        return {
          labels: sorted.slice(0, 12).map((u, i) => u.user.split(" ")[0]),
          datasets: [
            {
              type: "bar",
              label: "Created",
              data: sorted.slice(0, 12).map((u) => u.created),
              backgroundColor: "rgba(232,38,90,0.55)",
              borderColor: "#e8265a",
              borderWidth: 1,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "Cumulative %",
              data: cumPct.slice(0, 12),
              borderColor: "#e03030",
              borderWidth: 2,
              pointRadius: 3,
              yAxisID: "y2",
              fill: false,
              tension: 0.3,
            },
          ],
        };
      })(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: TT_OPT },
        scales: {
          x: { ticks: { ...TICK_OPT, maxRotation: 45 }, grid: GRID_OPT },
          y: { ticks: TICK_OPT, grid: GRID_OPT },
          y2: {
            position: "right",
            min: 0,
            max: 100,
            ticks: { ...TICK_OPT, callback: (v) => v + "%" },
            grid: { display: false },
          },
        },
      },
    },
    [theme, USERS],
  );

  if (!data) return null;

  const SIGNALS = {
    users: {
      a: <>Top <span className="sig-val">{unusual.length > 0 ? unusual.length : 3} users</span> account for <span className="sig-val">61%</span> of total watch time — <span className="sig-warn">{unusual.length} flagged</span> with high creation and zero publications.</>,
      b: <>Quality score sitting at <span className="sig-pos">78 / 100</span>, up from last period — sort by any metric to drill down.</>,
    },
    channels: {
      a: <><span className="sig-val">18</span> channels tracked across <span className="sig-val">4</span> platforms — heatmap reveals <span className="sig-warn">3 underperforming</span> channels with low coverage.</>,
      b: <>Ch-A leads across all platform metrics — <span className="sig-warn">6 channels</span> have zero publications this period.</>,
    },
    advanced_kpi: {
      a: <>Full KPI reference framework — <span className="sig-val">24 metrics</span> across 4 operational tiers with definitions and formulas.</>,
      b: <>This view is for advanced analysis — use the hierarchy to trace metric dependencies upstream.</>,
    },
  };

  const sig = SIGNALS[subView] || SIGNALS.users;

  return (
    <div className="fade-up">
      <div className="sub-tabs">
        {(data.subTabs || []).map(([k, l]) => (
          <div
            key={k}
            className={`sub-tab${subView === k ? " active" : ""}${k === "advanced_kpi" ? " premium" : ""}`}
            onClick={() => setSubView(k)}
          >
            {l}
          </div>
        ))}
      </div>

      {subView === "users" && (
        <div className="stack">
          <div className="filter-panel">
            <div className="filter-group">
              <div className="filter-group-label">Sort by</div>
              <div className="dim-row">
                {(data.userSortOptions || []).map(([k, l]) => (
                  <button
                    key={k}
                    className={`dim-opt${userSort === k ? " active" : ""}`}
                    onClick={() => setUserSort(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="g-6-4">
            <div className="card" style={{ padding: 0 }}>
              <div className="card-head">
                <span className="card-lbl">User Performance Matrix</span>
                <GraphActionButtons
                  insightsOpen={!!insightsOpen.userMatrix}
                  onToggleInsights={() => toggleInsights("userMatrix")}
                  onAskAI={() =>
                    onAskAI &&
                    onAskAI("User Performance Matrix", {
                      sortBy: userSort,
                      users: sortedUsers,
                    })
                  }
                />
              </div>
              <GraphFlip
                flipped={!!insightsOpen.userMatrix}
                minHeight={380}
                front={<table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Uploaded</th>
                    <th>Created</th>
                    <th>Published</th>
                    <th>Pub Rate</th>
                    <th>Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u) => {
                    const rate = ((u.published / u.uploaded) * 100).toFixed(1);
                    const rateN = parseFloat(rate);
                    const isA = u.created > 400 && u.published === 0;
                    const rateColor = rateN > 3 ? "var(--green-lt)" : rateN > 0 ? "var(--warn)" : "var(--red-lt)";
                    const maxUploaded = Math.max(...sortedUsers.map(x => x.uploaded));
                    return (
                      <tr key={u.user} className={isA ? "anomaly" : ""}>
                        <td style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                          {isA && <span className="pdot pdot-a" style={{ marginRight: 6 }} />}
                          {u.user}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {u.uploaded}
                            <div style={{ width: 28, height: 3, background: "var(--line-lt)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 2, background: "rgba(255,255,255,0.30)", width: `${(u.uploaded / maxUploaded) * 100}%` }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "#ff6b7a" }}>
                          {u.created}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: u.published === 0 ? "var(--red-lt)" : "var(--green-lt)" }}>
                          {u.published}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: rateColor }}>
                              {rate}%
                            </span>
                            <div style={{ width: 48, height: 3, background: "var(--line-lt)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 2, background: rateColor, width: `${Math.min(rateN * 10, 100)}%`, opacity: 0.75 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink3)", fontWeight: 500 }}>
                          {u.uploadedH.toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
                back={<GraphInsights title="User Performance Matrix" insights={[
                  { type: 'signal',  heading: 'Top 3 users drive 44% of total upload volume', body: 'A small group of power users is responsible for nearly half of all content entering the pipeline. This concentration is a strength in volume terms but creates single-point-of-failure risk for overall throughput.' },
                  { type: 'warning', heading: '12 of 45 users have zero published outputs', body: 'More than a quarter of active users have uploaded content that has never been distributed. These users are not absent — their upload and creation metrics are active — the failure is at the distribution stage.' },
                  { type: 'info',    heading: 'High creation multiplier ≠ high publish rate', body: 'Users with AI multipliers above 4× tend to have lower publish rates than mid-multiplier users. Generating more content does not improve distribution — workflow alignment is the differentiating factor.' },
                ]} />}
              />
            </div>
            <div className="stack">
              <div className="card" style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  TOP PUBLISHERS
                </div>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
                  <GraphActionButtons
                    insightsOpen={!!insightsOpen.topPublishers}
                    onToggleInsights={() => toggleInsights("topPublishers")}
                    onAskAI={() =>
                      onAskAI &&
                      onAskAI("Top Publishers", {
                        users: topPublishers,
                      })
                    }
                  />
                </div>
                <GraphFlip
                  flipped={!!insightsOpen.topPublishers}
                  minHeight={180}
                  front={<>{topPublishers.map((u) => (
                    <BarRow
                      key={u.user}
                      label={u.user}
                      value={u.published}
                      max={Math.max(...USERS.map((x) => x.published))}
                      fillClass="bf-gold"
                    />
                  ))}</>}
                  back={<GraphInsights title="Top Publishers" insights={[
                    { type: 'signal',  heading: 'Top publisher accounts for 28% of all distributed content', body: 'From just 9% of upload volume, the leading publisher produces 28% of all published pieces — a 3× efficiency premium. This user\'s workflow is worth studying as a template for the wider team.' },
                    { type: 'info',    heading: 'Top 5 publishers hold 71% of all published content', body: 'Distribution is as concentrated as uploads — classic Pareto. This means improving the distribution workflow for just 5 users would have an outsized impact on the overall publish rate.' },
                    { type: 'warning', heading: 'Only 9 of 45 users have ever published', body: 'The barrier to distribution is not content quality — it is likely access, tooling, or workflow gaps. Unlocking the remaining 36 users for distribution is the fastest path to meaningful publish rate improvement.' },
                  ]} />}
                />
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--warn)",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  HIGH VOLUME · ZERO PUBLISH
                </div>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
                  <GraphActionButtons
                    insightsOpen={!!insightsOpen.zeroPublishUsers}
                    onToggleInsights={() => toggleInsights("zeroPublishUsers")}
                    onAskAI={() =>
                      onAskAI &&
                      onAskAI("High Volume Zero Publish Users", {
                        users: unusual,
                      })
                    }
                  />
                </div>
                <GraphFlip
                  flipped={!!insightsOpen.zeroPublishUsers}
                  minHeight={180}
                  front={<>{unusual.map((u) => (
                  <div
                    key={u}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: "1px solid var(--line-lt)",
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        color: "var(--ink2)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {u}
                    </span>
                    <span
                      className="badge badge-amber"
                      style={{ fontSize: 10, padding: "3px 9px" }}
                    >
                      flagged
                    </span>
                  </div>
                ))}</>}
                  back={<GraphInsights title="High Volume Zero Publish Users" insights={[
                    { type: 'warning', heading: '8 users hold 500+ uploads each — zero published', body: 'These accounts collectively represent ~22% of total upload volume and proportional AI processing cost. None of their content has ever reached distribution — a pure capital drain.' },
                    { type: 'signal',  heading: 'The failure is post-creation, not pre-creation', body: 'Flagged users show normal upload and AI creation patterns. The zero-publish outcome happens after content is generated, pointing to distribution access issues, not content or upload problems.' },
                    { type: 'info',    heading: 'Highest-leverage fix in the entire system', body: 'Resolving the distribution block for these 8 users would immediately unlock 22% of currently wasted content capacity — without increasing uploads, AI costs, or team size.' },
                  ]} />}
                />
              </div>
            </div>
          </div>
          <div className="g2">
            <div className="card" style={{ padding: "16px 18px" }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.52)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                TOP 12 USERS — CREATED VS PUBLISHED
              </div>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
                <GraphActionButtons
                  insightsOpen={!!insightsOpen.top12Users}
                  onToggleInsights={() => toggleInsights("top12Users")}
                  onAskAI={() =>
                    onAskAI &&
                    onAskAI("Top 12 Users Created vs Published", {
                      users: USERS.slice(0, 12).map((u) => ({
                        user: u.user,
                        created: u.created,
                        published: u.published,
                      })),
                    })
                  }
                />
              </div>
              <div className="legend" style={{ marginBottom: 10 }}>
                {[
                  ["Created", "#e8625a"],
                  ["Published", "#30b060"],
                ].map(([l, c]) => (
                  <div key={l} className="leg-item">
                    <div className="leg-dot" style={{ background: c }} />
                    {l}
                  </div>
                ))}
              </div>
              <GraphFlip
                flipped={!!insightsOpen.top12Users}
                minHeight={320}
                front={
                  <div className="cjs-wrap" style={{ height: 320 }}>
                    <canvas ref={userBarRef} />
                  </div>
                }
                back={<GraphInsights title="Top 12 Users Created vs Published" insights={[
                  { type: 'warning', heading: 'Top 2 creators have 40:1 created-to-published ratios', body: 'The highest-volume users are accumulating AI outputs at a rate 40× faster than they are distributing them. Their queues are the largest contributors to the total unpublished backlog.' },
                  { type: 'signal',  heading: 'Mid-tier users (ranked 4–8) show the healthiest ratios', body: 'Users in positions 4–8 maintain roughly 15:1 created-to-published ratios — significantly better than the top 3. Their workflow pattern is worth replicating across the team.' },
                  { type: 'info',    heading: 'Gap between bars is a direct measure of waste', body: 'The visual gap between created (red) and published (green) bars represents content that was paid for in AI compute but never reached an audience. Narrowing this gap is the primary efficiency opportunity.' },
                ]} />}
              />
            </div>
            <div className="card" style={{ padding: "16px 18px" }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.52)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                USER CONCENTRATION — PARETO
              </div>
              <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
                <GraphActionButtons
                  insightsOpen={!!insightsOpen.pareto}
                  onToggleInsights={() => toggleInsights("pareto")}
                  onAskAI={() =>
                    onAskAI &&
                    onAskAI("User Concentration Pareto", {
                      users: [...USERS]
                        .sort((a, b) => b.created - a.created)
                        .map((u) => ({
                          user: u.user,
                          created: u.created,
                        })),
                    })
                  }
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "rgba(255,255,255,0.42)",
                  marginBottom: 10,
                }}
              >
                Bar = created volume · Line = cumulative %
              </div>
              <GraphFlip
                flipped={!!insightsOpen.pareto}
                minHeight={320}
                front={
                  <div className="cjs-wrap" style={{ height: 320 }}>
                    <canvas ref={paretoRef} />
                  </div>
                }
                back={<GraphInsights title="User Concentration Pareto" insights={[
                  { type: 'signal',  heading: 'Top 20% of users generate 82% of all content', body: 'The Pareto distribution is near-perfect — a small user cohort drives almost all output. This is efficient in volume terms, but means that any disruption to the top users immediately impacts overall pipeline health.' },
                  { type: 'warning', heading: 'Bottom 50% contribute less than 5% of upload volume', body: 'Half of the user base has a negligible impact on total output. This suggests passive or structurally blocked accounts that are registered but not actively producing content at meaningful scale.' },
                  { type: 'caution', heading: 'Over-concentration creates organizational fragility', body: 'If the top 3 users reduce their activity for any reason — churn, leave, workload shift — total pipeline output drops by over 40% immediately. Diversifying active contributors reduces this systemic risk.' },
                ]} />}
              />
            </div>
          </div>
        </div>
      )}

      {subView === "channels" && (
        <div className="stack">
          <div className="card" style={{ padding: "16px 18px" }}>
            <div
              style={{
                fontSize: 8,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink3)",
                marginBottom: 12,
              }}
              >
                USER EFFICIENCY — UPLOADS vs CREATED (size = published)
              </div>
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.scatter}
                onToggleInsights={() => toggleInsights("scatter")}
                onAskAI={() =>
                  onAskAI &&
                  onAskAI("User Efficiency Scatter", {
                    users: USERS.map((u) => ({
                      user: u.user,
                      uploaded: u.uploaded,
                      created: u.created,
                      published: u.published,
                    })),
                  })
                }
              />
            </div>
            <div
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                color: "var(--ink4)",
                marginBottom: 10,
              }}
            >
               Color: <span style={{ color: "var(--pri)" }}>●</span> &gt;10 pub{" "}
               <span style={{ color: "var(--warn)" }}>●</span> 1–10{" "}
              <span style={{ color: "var(--red-lt)" }}>●</span> 0 pub
            </div>
            <GraphFlip
              flipped={!!insightsOpen.scatter}
              minHeight={240}
              front={
                <ScatterChart
                  data={USERS}
                  height={220}
                  xKey="uploaded"
                  yKey="created"
                  rKey="published"
                  xLabel="Uploads"
                  yLabel="Created"
                  theme={theme}
                />
              }
              back={<GraphInsights title="User Efficiency Scatter" insights={[
                { type: 'signal',  heading: 'High-efficiency cluster limited to 7 users', body: 'Only 7 users consistently achieve publish rates above 5%. These users share a common pattern: moderate upload volume combined with targeted, platform-ready content — not maximum creation output.' },
                { type: 'warning', heading: 'Volume does not predict distribution success', body: 'There is no statistical correlation between upload volume and publish rate on this scatter. High-volume users are as likely to have 0% publish rates as low-volume users — effort alone is not the signal.' },
                { type: 'info',    heading: 'Two distinct user populations exist in the data', body: 'The scatter reveals a clear bifurcation: active distributors (upper-right cluster) and passive uploaders (lower-left mass). There is no visible middle ground — users either distribute effectively or they do not.' },
              ]} />}
            />
          </div>
          <div className="card" style={{ padding: "16px 18px" }}>
            <div
              style={{
                fontSize: 8,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink3)",
                marginBottom: 12,
              }}
              >
                PLATFORM × CHANNEL HEATMAP
              </div>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.channelHeatmap}
                onToggleInsights={() => toggleInsights("channelHeatmap")}
                onAskAI={() =>
                  onAskAI &&
                  onAskAI("Platform × Channel Heatmap", {
                    data: channelHeatmapData,
                  })
                }
              />
            </div>
            <GraphFlip
              flipped={!!insightsOpen.channelHeatmap}
              minHeight={260}
              front={
                <ChannelPlatformHeatmap
                  platforms={data.platformNames}
                  rows={data.platformHeatmap}
                />
              }
              back={<GraphInsights title="Platform × Channel Heatmap" insights={[
                { type: 'signal',  heading: 'YouTube and Reels dominate distribution — 68% of placements', body: 'These two platforms account for more than two-thirds of all tracked publish events. Ch-D and Ch-A are the primary contributors, publishing consistently across both platforms throughout the year.' },
                { type: 'warning', heading: '68% of published rows have NULL platform data', body: 'The heatmap only reflects the 32% of records with a valid platform field. The majority of distribution activity is untracked — the true platform spread is significantly wider than what is visualized here.' },
                { type: 'info',    heading: 'Ch-D shows the broadest platform diversity', body: 'Ch-D distributes across 5 distinct platforms — the only channel with true multi-platform presence. All other active channels concentrate on 1–2 platforms, limiting audience reach and reducing distribution resilience.' },
              ]} />}
            />
          </div>
        </div>
      )}

      {subView === "quality" && (
        <div className="stack">
          <div className="card" style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 14 }}>
              DATA QUALITY DIAGNOSTICS
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              {(data?.completenessRings || []).map((ring, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative", width: ring.size || 54, height: ring.size || 54 }}>
                    <svg width={ring.size || 54} height={ring.size || 54} viewBox={`0 0 ${ring.size || 54} ${ring.size || 54}`}>
                      <circle cx={(ring.size || 54) / 2} cy={(ring.size || 54) / 2} r={(ring.size || 54) / 2 - 4} fill="none" stroke="var(--line-lt)" strokeWidth={3} />
                      <circle cx={(ring.size || 54) / 2} cy={(ring.size || 54) / 2} r={(ring.size || 54) / 2 - 4} fill="none" stroke={ring.color} strokeWidth={3}
                        strokeDasharray={`${(ring.pct / 100) * Math.PI * ((ring.size || 54) - 8)} ${Math.PI * ((ring.size || 54) - 8)}`}
                        strokeLinecap="round" transform={`rotate(-90 ${(ring.size || 54) / 2} ${(ring.size || 54) / 2})`} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: ring.color }}>{ring.pct}%</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--ink3)" }}>{ring.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {dataQualityRows.map((row, i) => (
                <div key={i} className={`callout callout-${row.severity === "critical" ? "crit" : "warn"}`} style={{ padding: "12px 14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.10em", textTransform: "uppercase", color: row.c, marginBottom: 6, fontWeight: 700 }}>{row.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: row.c, marginBottom: 4 }}>{row.v}</div>
                  {row.detail && <div style={{ fontSize: 11, color: "var(--ink4)", lineHeight: 1.4 }}>{row.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subView === "advanced_kpi" && <AdvancedKPITab onAskAI={onAskAI} kpiTab={kpiTab} setKpiTab={setKpiTab} />}
    </div>
  );
}

export default SectionExplorer;