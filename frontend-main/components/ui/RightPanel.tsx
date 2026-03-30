// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDash } from '@/lib/contexts';
import { ANOMALIES, SAVED_VIEWS, STORY_PRESETS, M } from '@/lib/constants';
import { sendChatMessage } from '@/lib/api';
import useChartJs from '../charts/ChartJSWrapper';

function coerceNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function inferYKeys(data, xKey, yKeys) {
  if (Array.isArray(yKeys) && yKeys.length) return yKeys;
  const first = Array.isArray(data) && data.length ? data[0] : null;
  if (!first) return [];
  return Object.keys(first).filter((k) => k !== xKey);
}

function CopilotChart({ artifact, id }) {
  const palette = ["#ff4757","#3EC98A","#7C83FF","#F7B731","#32A1FF","#FF8A5B"];
  const config = useMemo(() => {
    const data = Array.isArray(artifact?.data) ? artifact.data : [];
    const xKey = artifact?.xKey || "name";
    const keys = inferYKeys(data, xKey, artifact?.yKeys);
    const labels = data.map((d, i) => {
      const label = d?.[xKey];
      return label === undefined || label === null ? String(i + 1) : String(label);
    });
    const rawType = String(artifact?.chartType || "bar").toLowerCase();
    const normalizedType = rawType === "stacked_bar" || rawType === "stacked" || rawType === "column" ? "bar" : rawType;
    const chartType = ["bar","line","area","pie","donut"].includes(normalizedType) ? normalizedType : "bar";
    const isPie = chartType === "pie" || chartType === "donut";
    const primaryKey = keys[0] || "value";
    const datasets = isPie
      ? [{ label: primaryKey, data: data.map(d => coerceNumber(d?.[primaryKey])), backgroundColor: labels.map((_, i) => palette[i % palette.length]), borderColor: "rgba(0,0,0,0.15)", borderWidth: 1 }]
      : keys.map((k, i) => ({ label: k, data: data.map(d => coerceNumber(d?.[k])), borderColor: palette[i % palette.length], backgroundColor: chartType === "bar" ? `${palette[i % palette.length]}B3` : `${palette[i % palette.length]}55`, borderWidth: 2, tension: 0.3, fill: chartType === "area" }));
    return {
      type: isPie ? "pie" : chartType === "area" ? "line" : chartType,
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: "rgba(245,245,247,0.7)", font: { size: 10, family: "var(--font-ibm-plex-mono,monospace)" } } },
          tooltip: { backgroundColor: "rgba(14,15,17,0.95)", titleColor: "#f5f5f7", bodyColor: "rgba(245,245,247,0.65)" },
        },
        scales: isPie ? undefined : {
          x: { ticks: { color: "rgba(245,245,247,0.65)", font: { size: 10, family: "var(--font-ibm-plex-mono,monospace)" }, maxRotation: 45 }, grid: { color: "rgba(255,255,255,0.06)" }, border: { display: false } },
          y: { ticks: { color: "rgba(245,245,247,0.65)", font: { size: 10, family: "var(--font-ibm-plex-mono,monospace)" }, callback: v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v }, grid: { color: "rgba(255,255,255,0.06)" }, border: { display: false }, beginAtZero: true },
        },
      },
    };
  }, [artifact]);
  const canvasRef = useChartJs(id, config, [id, config]);
  return <div style={{ position: "relative", width: "100%", height: 200 }}><canvas ref={canvasRef} /></div>;
}

function CopilotTable({ artifact }) {
  const rows = Array.isArray(artifact?.data) ? artifact.data : [];
  const columns = Array.isArray(artifact?.columns) && artifact.columns.length ? artifact.columns : rows.length ? Object.keys(rows[0]) : [];
  if (!rows.length || !columns.length) return null;
  return (
    <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead><tr>{columns.map(col => <th key={col} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{col}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{columns.map(col => <td key={col} style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap" }}>{row?.[col] ?? ""}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function RightPanel({ open, activeTab, setActiveTab, onClose, attachedData, onRemoveData }: any) {
  const dash = useDash();

  return (
    <div className={`rp-shell${open ? ' open' : ''}`}>
      <div className="rp-tabs" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          <span style={{ fontSize: 13 }}>⊹</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>Copilot</span>
        </div>
        <button className="rp-close" onClick={onClose}>✕</button>
      </div>

      <div className="rp-body">
        <CopilotTab dash={dash} attachedData={attachedData} onRemoveData={onRemoveData} />
      </div>
    </div>
  );
}

function ExplainTab({ dash }: any) {
  const sel = dash?.selectedCtx || {};
  const hasSelection = sel.channel || sel.month || sel.language || sel.user;

  if (!hasSelection) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">◈</div>
        <div className="empty-state-text">Select a data point to see detailed explanation</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="explain-action" onClick={() => dash?.selectCtx?.({ month: "Feb'26" })}>Feb 2026</button>
          <button className="explain-action" onClick={() => dash?.selectCtx?.({ channel: 'D' })}>Ch-D</button>
          <button className="explain-action" onClick={() => dash?.selectCtx?.({ language: 'English' })}>English</button>
        </div>
      </div>
    );
  }

  const entity = sel.channel ? `Channel ${sel.channel}` : sel.month || sel.language || sel.user || '';

  return (
    <>
      <div className="explain-card">
        <div className="explain-entity">{entity}</div>
        <div className="explain-delta">Primary metric: {M.publishRate}% publish rate platform average</div>
        <div className="explain-row"><span className="explain-lbl">Uploaded</span><span className="explain-val">{M.uploaded.toLocaleString()}</span></div>
        <div className="explain-row"><span className="explain-lbl">Created</span><span className="explain-val">{M.created.toLocaleString()}</span></div>
        <div className="explain-row"><span className="explain-lbl">Published</span><span className="explain-val">{M.published}</span></div>
        <div className="explain-row"><span className="explain-lbl">AI Multiplier</span><span className="explain-val">{M.multiplier}×</span></div>
        <div className="explain-actions">
          <button className="explain-action" onClick={() => dash?.startInvestigation?.('pub_gap')}>⚑ Investigate</button>
          <button className="explain-action" onClick={() => dash?.pinFinding?.({ id: entity, label: entity })}>📌 Pin</button>
        </div>
      </div>
    </>
  );
}

function EvidenceTab({ dash }: any) {
  return (
    <>
      <div className="rp-section-lbl">Anomalies</div>
      {ANOMALIES.map(a => (
        <div key={a.id} className="ev-item" onClick={() => dash?.startInvestigation?.(a.id)}>
          <div className="ev-item-label">{a.type === 'crit' ? '⚑ CRITICAL' : '⚠ WARNING'}</div>
          <div className="ev-item-val">{a.title}</div>
          <div className="ev-item-sub">{a.detail}</div>
        </div>
      ))}

      {dash?.pinnedFindings?.length > 0 && (
        <>
          <div className="rp-section-lbl">Pinned Findings</div>
          {dash.pinnedFindings.map((p: any) => (
            <div key={p.id} className="pin-item">
              📌 {p.label}
              <span className="pin-item-x" onClick={() => dash?.unpinFinding?.(p.id)}>✕</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function CompareTab({ dash }: any) {
  const cs = dash?.compareState;

  if (!cs) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⇔</div>
        <div className="empty-state-text">Start a comparison to see side-by-side analysis</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, width: '100%' }}>
          <button className="explain-action" onClick={() => dash?.openCompare?.('channel', 'A', 'channel', 'D')}>⇔ Ch-A vs Ch-D</button>
          <button className="explain-action" onClick={() => dash?.openCompare?.('language', 'English', 'language', 'Hindi')}>⇔ English vs Hindi</button>
          <button className="explain-action" onClick={() => dash?.openCompare?.('period', 'H1', 'period', 'H2')}>⇔ H1 vs H2</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rp-section-lbl">Comparison</div>
      <div className="explain-card">
        <div className="explain-entity">{cs.a} vs {cs.b}</div>
        <div className="explain-delta">Type: {cs.typeA}</div>
        <div className="explain-actions">
          <button className="explain-action" onClick={() => dash?.closeCompare?.()}>Close comparison</button>
        </div>
      </div>
    </>
  );
}

function ViewsTab({ dash }: any) {
  return (
    <>
      <div className="rp-section-lbl">Saved Views</div>
      {SAVED_VIEWS.map(v => (
        <div
          key={v.id}
          className="sv-item"
          onClick={() => {
            dash?.scrollToSection?.(v.section);
            if (v.anomaly) dash?.startInvestigation?.(v.anomaly);
            if (v.panelTab) dash?.openPanel?.(v.panelTab);
          }}
        >
          <div className="sv-icon">{v.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sv-name">{v.name}</div>
            <div className="sv-desc">{v.desc}</div>
          </div>
          <span className="sv-arrow">›</span>
        </div>
      ))}

      <div className="rp-section-lbl" style={{ marginTop: 20 }}>Story Presets</div>
      {STORY_PRESETS.map(s => (
        <div key={s.id} className="sv-item" onClick={() => dash?.startStory?.(s.id)}>
          <div className="sv-icon">▶</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sv-name">{s.title}</div>
            <div className="sv-desc">{s.narrative.slice(0, 60)}...</div>
          </div>
          <span className="sv-arrow">›</span>
        </div>
      ))}
    </>
  );
}

function CopilotTab({ dash, attachedData, onRemoveData }: any) {
  /* ── State ── */
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your AI Data Analyst. I can help explore your data, answer questions, and generate chart or table insights.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<'auto' | 'explain' | 'kpi' | 'analytics'>('auto');
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const CHAT_MODES = [
    { id: 'auto'      as const, label: 'Auto',      desc: 'Let AI pick the best approach', icon: '⊹' },
    { id: 'explain'   as const, label: 'Explain',   desc: 'Narrative explanations',         icon: '◈' },
    { id: 'kpi'       as const, label: 'KPI',       desc: 'Metric & KPI focused answers',   icon: '⌇' },
    { id: 'analytics' as const, label: 'Analytics', desc: 'Deep data analysis',             icon: '⬡' },
  ];

  const QUICK_PROMPTS = [
    { label: 'What is the overall publish rate?',   icon: '⌇' },
    { label: 'Channels with highest volume',         icon: '◈' },
    { label: 'Show me monthly trend breakdown',      icon: '⬡' },
  ];

  const sel = dash?.selectedCtx || {};
  const hasContext = sel.channel || sel.month || sel.language || sel.user;
  const sources = Array.isArray(attachedData) ? attachedData : [];
  const currentMode = CHAT_MODES.find(m => m.id === chatMode)!;
  const isOnlyWelcome = messages.length <= 1;

  /* ── Handlers ── */
  const resetMessages = () => {
    setMessages([{ role: 'assistant', text: 'Chat cleared. Ask me anything about the dashboard data.' }]);
    setSessionId(null);
  };

  const handleSend = async (txt?: string) => {
    const userMsg = (txt ?? input).trim();
    if (!userMsg || loading) return;
    const updatedMessages = [...messages, { role: 'user' as const, text: userMsg }];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    const attachedSources = sources.map((s: any) => ({ name: s.name, data: s.data }));

    // Build conversation_context from last few messages as fallback for backend
    const recentMsgs = updatedMessages.slice(-10);
    const conversationContext = recentMsgs
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.slice(0, 300)}`)
      .join('\n');

    try {
      const chatRes = await fetch('/api/proxy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg, session_id: sessionId,
          attached_sources: attachedSources,
          context: hasContext ? sel : undefined,
          mode: chatMode,
          conversation_context: conversationContext,
        }),
      });
      if (!chatRes.ok) throw new Error('Chat request failed');
      const chatData = await chatRes.json();
      setSessionId(chatData.session_id);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: chatData.response || 'No response returned.',
        artifacts: chatData.artifacts || [],
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Unable to reach the backend. ${e?.message ? `(${e.message})` : 'Make sure the server is running on port 8000.'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  /* ─────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-16px', overflow: 'hidden', background: '#080808' }}>

      {/* ── Keyframes (injected once) ── */}
      <style>{`
        @keyframes cop-dot { 0%,80%,100%{opacity:.25;transform:scale(.85)} 40%{opacity:1;transform:scale(1.2)} }
        @keyframes cop-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Context capsule ── */}
      {hasContext && (
        <div style={{
          display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
          padding:'8px 16px', borderBottom:'0.5px solid rgba(255,255,255,0.06)',
          background:'rgba(255,71,87,0.04)', flexShrink:0,
        }}>
          <span style={{fontSize:9,fontFamily:'var(--font-mono)',letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,71,87,0.65)',fontWeight:600}}>Context</span>
          {[
            sel.channel && `Ch-${sel.channel}`,
            sel.month, sel.language, sel.user,
          ].filter(Boolean).map((tag:string) => (
            <span key={tag} style={{fontSize:11,background:'rgba(255,71,87,0.10)',border:'0.5px solid rgba(255,71,87,0.22)',borderRadius:5,padding:'2px 8px',color:'rgba(255,130,110,0.90)',fontFamily:'var(--font-mono)'}}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Chat body ── */}
      <div ref={chatRef} style={{
        flex:1, overflowY:'auto', padding:'20px 16px',
        display:'flex', flexDirection:'column', gap:14,
        scrollbarWidth:'none',
      }}>

        {messages.map((msg, i) => (
          <div key={i} style={{
            display:'flex', flexDirection: msg.role==='user' ? 'row-reverse' : 'row',
            alignItems:'flex-start', gap:10,
            animation:'cop-fadein 0.22s ease both',
          }}>
            {/* Avatar */}
            {msg.role === 'assistant' ? (
              <div style={{
                width:30,height:30,borderRadius:'50%',flexShrink:0,
                background:'linear-gradient(135deg,#ff4757 0%,#c0392b 100%)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:12,fontWeight:700,color:'#fff',fontFamily:'var(--font-sans)',
                boxShadow:'0 0 0 1px rgba(255,71,87,0.30),0 4px 12px rgba(255,71,87,0.20)',
              }}>F</div>
            ) : (
              <div style={{
                width:30,height:30,borderRadius:'50%',flexShrink:0,
                background:'rgba(255,255,255,0.07)',border:'0.5px solid rgba(255,255,255,0.14)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11,color:'rgba(255,255,255,0.50)',
              }}>U</div>
            )}

            {/* Bubble */}
            <div style={{
              maxWidth:'78%',
              background: msg.role==='user' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${msg.role==='user' ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: msg.role==='user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
              padding:'11px 14px',
            }}>
              <p style={{
                margin:0, fontSize:13.5, lineHeight:1.65,
                color: msg.role==='user' ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.75)',
                fontFamily:'var(--font-sans)', letterSpacing:'-0.01em',
                whiteSpace:'pre-wrap', wordBreak:'break-word',
              }}>{msg.text}</p>

              {/* Artifacts — charts & tables */}
              {Array.isArray(msg.artifacts) && msg.artifacts.length > 0 && (
                <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:10}}>
                  {msg.artifacts.map((a:any,idx:number)=>(
                    <div key={idx} style={{
                      background:'rgba(255,255,255,0.02)',border:'0.5px solid rgba(255,255,255,0.08)',
                      borderRadius:10, overflow:'hidden',
                    }}>
                      {a.title && (
                        <div style={{padding:'8px 12px',borderBottom:'0.5px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontSize:10,color:'rgba(255,71,87,0.65)'}}>◈</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,0.55)',fontFamily:'var(--font-mono)',letterSpacing:'0.03em'}}>{a.title}</span>
                        </div>
                      )}
                      <div style={{padding:'10px 12px'}}>
                        {a.type === 'chart' && <CopilotChart artifact={a} id={`cop-chart-${i}-${idx}`} />}
                        {a.type === 'table' && <CopilotTable artifact={a} />}
                        {a.type !== 'chart' && a.type !== 'table' && (
                          <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontFamily:'var(--font-mono)'}}>{a.type||'artifact'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{display:'flex',alignItems:'flex-start',gap:10,animation:'cop-fadein 0.22s ease both'}}>
            <div style={{
              width:30,height:30,borderRadius:'50%',flexShrink:0,
              background:'linear-gradient(135deg,#ff4757 0%,#c0392b 100%)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:12,fontWeight:700,color:'#fff',
              boxShadow:'0 0 0 1px rgba(255,71,87,0.30),0 4px 12px rgba(255,71,87,0.20)',
            }}>F</div>
            <div style={{
              background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.07)',
              borderRadius:'4px 14px 14px 14px',padding:'14px 18px',
              display:'flex',alignItems:'center',gap:6,
            }}>
              {[0,1,2].map(d=>(
                <div key={d} style={{
                  width:6,height:6,borderRadius:'50%',
                  background:'rgba(255,71,87,0.55)',
                  animation:`cop-dot 1.2s ease-in-out ${d*0.2}s infinite`,
                }}/>
              ))}
            </div>
          </div>
        )}

        {/* Suggested prompts (empty state) */}
        {isOnlyWelcome && !loading && (
          <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:7}}>
            <div style={{fontSize:9,fontFamily:'var(--font-mono)',letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.22)',marginBottom:2}}>
              Suggested
            </div>
            {QUICK_PROMPTS.map(p => (
              <button
                key={p.label}
                onClick={() => handleSend(p.label)}
                style={{
                  display:'flex',alignItems:'center',gap:10,
                  width:'100%',padding:'10px 14px',textAlign:'left',
                  background:'rgba(255,255,255,0.025)',
                  border:'0.5px solid rgba(255,255,255,0.07)',
                  borderRadius:10,cursor:'pointer',transition:'all 0.15s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,71,87,0.07)';e.currentTarget.style.borderColor='rgba(255,71,87,0.22)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.025)';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';}}
              >
                <span style={{fontSize:15,flexShrink:0,color:'rgba(255,71,87,0.55)'}}>{p.icon}</span>
                <span style={{fontSize:13,color:'rgba(255,255,255,0.62)',fontFamily:'var(--font-sans)',letterSpacing:'-0.01em',flex:1}}>{p.label}</span>
                <span style={{fontSize:15,color:'rgba(255,255,255,0.18)',flexShrink:0}}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Attached sources strip ── */}
      {sources.length > 0 && (
        <div style={{
          padding:'8px 14px',borderTop:'0.5px solid rgba(255,255,255,0.06)',
          display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',flexShrink:0,
          background:'rgba(255,255,255,0.015)',
        }}>
          <span style={{fontSize:9,fontFamily:'var(--font-mono)',letterSpacing:'0.10em',textTransform:'uppercase',color:'rgba(255,255,255,0.22)',flexShrink:0}}>Sources</span>
          {sources.map((source:any) => (
            <div key={source.name} style={{
              display:'inline-flex',alignItems:'center',gap:5,
              padding:'3px 7px 3px 9px',
              background:'rgba(255,71,87,0.07)',border:'0.5px solid rgba(255,71,87,0.20)',
              borderRadius:20,fontSize:11,color:'rgba(255,155,135,0.90)',
              fontFamily:'var(--font-sans)',fontWeight:500,
            }}>
              <span style={{fontSize:10,opacity:0.60}}>◈</span>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>{source.name}</span>
              <button
                onClick={()=>onRemoveData?.(source.name)}
                style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,155,135,0.50)',fontSize:11,lineHeight:1,padding:0,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',width:14,height:14,flexShrink:0,transition:'color 0.12s'}}
                onMouseEnter={e=>{e.currentTarget.style.color='#ff4757';}}
                onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,155,135,0.50)';}}
                title={`Remove ${source.name}`}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        padding:'10px 12px 14px',flexShrink:0,
        borderTop:'0.5px solid rgba(255,255,255,0.06)',
        background:'#080808',
        display:'flex',flexDirection:'column',gap:9,
      }}>

        {/* Top row: mode selector + clear */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>

          {/* Mode dropdown trigger */}
          <div style={{position:'relative'}}>
            <button
              onClick={()=>setModeDropdownOpen(v=>!v)}
              title="Select response mode"
              style={{
                display:'flex',alignItems:'center',gap:7,
                padding:'5px 11px',cursor:'pointer',
                background: modeDropdownOpen ? 'rgba(255,71,87,0.10)' : 'rgba(255,255,255,0.04)',
                border:`0.5px solid ${modeDropdownOpen ? 'rgba(255,71,87,0.35)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius:8,transition:'all 0.14s',
              }}
            >
              <span style={{fontSize:13,color:modeDropdownOpen?'rgba(255,100,80,0.90)':'rgba(255,71,87,0.60)'}}>{currentMode.icon}</span>
              <span style={{fontSize:11.5,fontWeight:500,color:'rgba(255,255,255,0.68)',fontFamily:'var(--font-sans)',letterSpacing:'-0.01em'}}>{currentMode.label}</span>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{opacity:0.40,flexShrink:0,transform:modeDropdownOpen?'rotate(180deg)':'none',transition:'transform 0.15s'}}>
                <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {modeDropdownOpen && (
              <>
                <div style={{position:'fixed',inset:0,zIndex:999}} onClick={()=>setModeDropdownOpen(false)}/>
                <div style={{
                  position:'absolute',bottom:'calc(100% + 8px)',left:0,zIndex:1000,
                  background:'#111',border:'0.5px solid rgba(255,255,255,0.10)',
                  borderRadius:12,padding:'5px',minWidth:202,
                  boxShadow:'0 20px 60px rgba(0,0,0,0.85)',
                }}>
                  {CHAT_MODES.map(mode=>(
                    <button
                      key={mode.id}
                      onClick={()=>{setChatMode(mode.id);setModeDropdownOpen(false);}}
                      style={{
                        display:'flex',alignItems:'center',gap:10,
                        width:'100%',padding:'9px 10px',border:'none',cursor:'pointer',
                        borderRadius:8,textAlign:'left',transition:'background 0.12s',
                        background: chatMode===mode.id ? 'rgba(255,71,87,0.10)' : 'transparent',
                      }}
                      onMouseEnter={e=>{if(chatMode!==mode.id)e.currentTarget.style.background='rgba(255,255,255,0.05)';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=chatMode===mode.id?'rgba(255,71,87,0.10)':'transparent';}}
                    >
                      <span style={{
                        width:26,height:26,borderRadius:7,flexShrink:0,
                        background: chatMode===mode.id ? 'rgba(255,71,87,0.18)' : 'rgba(255,255,255,0.05)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:14,color: chatMode===mode.id ? 'rgba(255,100,80,1)' : 'rgba(255,255,255,0.38)',
                        transition:'all 0.12s',
                      }}>{mode.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight: chatMode===mode.id ? 600 : 400,color: chatMode===mode.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.68)',fontFamily:'var(--font-sans)',letterSpacing:'-0.01em'}}>
                          {mode.label}
                        </div>
                        <div style={{fontSize:10.5,color:'rgba(255,255,255,0.30)',fontFamily:'var(--font-sans)',marginTop:2}}>
                          {mode.desc}
                        </div>
                      </div>
                      <span style={{fontSize:12,color:'rgba(255,71,87,0.85)',fontWeight:700,flexShrink:0,opacity:chatMode===mode.id?1:0}}>✓</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Clear */}
          <button
            onClick={resetMessages}
            title="Clear conversation"
            style={{
              padding:'5px 12px',cursor:'pointer',
              background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.09)',
              borderRadius:8,fontSize:11.5,color:'rgba(255,255,255,0.40)',
              fontFamily:'var(--font-sans)',transition:'all 0.14s',letterSpacing:'-0.01em',
            }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(255,255,255,0.72)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='rgba(255,255,255,0.40)';}}
          >Clear</button>
        </div>

        {/* Input row */}
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <input
            placeholder={sources.length > 0 ? `Ask about "${sources[sources.length-1].name}"…` : 'Ask anything about the data…'}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleSend()}
            style={{
              width:'100%',height:42,padding:'0 48px 0 14px',
              background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(255,255,255,0.10)',
              borderRadius:11,fontSize:13.5,color:'rgba(255,255,255,0.85)',
              fontFamily:'var(--font-sans)',letterSpacing:'-0.01em',outline:'none',
              transition:'border-color 0.15s,background 0.15s',
              boxSizing:'border-box',
            }}
            onFocus={e=>{e.currentTarget.style.borderColor='rgba(255,71,87,0.45)';e.currentTarget.style.background='rgba(255,255,255,0.07)';}}
            onBlur={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.10)';e.currentTarget.style.background='rgba(255,255,255,0.05)';}}
          />
          <button
            onClick={()=>handleSend()}
            disabled={loading||!input.trim()}
            style={{
              position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',
              width:30,height:30,borderRadius:9,border:'none',
              cursor: loading||!input.trim() ? 'default' : 'pointer',
              background: loading||!input.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#ff4757,#c0392b)',
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all 0.15s',flexShrink:0,
              boxShadow: !loading&&input.trim() ? '0 2px 14px rgba(255,71,87,0.40)' : 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{opacity:loading||!input.trim()?0.28:1,transition:'opacity 0.15s'}}>
              <path d="M6.5 11V2M6.5 2L3 5.5M6.5 2L10 5.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

