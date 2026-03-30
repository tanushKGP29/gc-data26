// @ts-nocheck
import { useState, useMemo } from "react";

function ChannelTable({ channels = [], onRowClick, selectedChannel }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('uploaded');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRows, setExpandedRows] = useState({});
  const [density, setDensity] = useState('normal');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let list = [...channels];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(ch => `ch-${ch.ch}`.toLowerCase().includes(q) || ch.ch.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = a[sortKey] || 0, bv = b[sortKey] || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [channels, search, sortKey, sortDir]);

  const handleExport = () => {
    const header = 'Channel,Uploaded,Created,Published,Rate\n';
    const rows = channels.map(ch => `Ch-${ch.ch},${ch.uploaded},${ch.created},${ch.published},${((ch.published / ch.uploaded) * 100).toFixed(1)}%`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'channels.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const compact = density === 'compact';

  return (
    <div>
      {/* Toolbar */}
      <div className="table-toolbar">
        <input
          className="table-search"
          placeholder="Search channels..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['uploaded', 'created', 'published'].map(k => (
          <button
            key={k}
            className={`tbl-sort-btn${sortKey === k ? ' active' : ''}`}
            onClick={() => handleSort(k)}
          >
            {k} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
        <button
          className="table-density-btn"
          onClick={() => setDensity(d => d === 'normal' ? 'compact' : 'normal')}
          title="Toggle density"
        >
          {compact ? '▤' : '▥'}
        </button>
        <button className="tbl-export-btn" onClick={handleExport} title="Export CSV">
          ↓ CSV
        </button>
      </div>

      {/* Table */}
      <div className="table-sticky-wrap">
        <div className="ch-row header">
          <span>Channel</span>
          <span>Publish Rate</span>
          <span style={{ cursor: 'pointer' }} onClick={() => handleSort('uploaded')}>Uploaded {sortKey === 'uploaded' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
          <span style={{ cursor: 'pointer' }} onClick={() => handleSort('created')}>Created {sortKey === 'created' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
          <span style={{ cursor: 'pointer' }} onClick={() => handleSort('published')}>Published {sortKey === 'published' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
          <span>Platforms</span>
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">⌕</div>
            <div className="empty-state-text">No channels match "{search}"</div>
            <button className="empty-state-action" onClick={() => setSearch('')}>Clear search</button>
          </div>
        )}

        {filtered.map((ch) => {
          const rate = (ch.published / ch.uploaded) * 100;
          const barColor = rate >= 10 ? "var(--suc)" : rate >= 5 ? "var(--warn)" : rate >= 1 ? "var(--warn-lt)" : "var(--dan-lt)";
          const platCount = Object.values(ch.platforms || {}).reduce((a, b) => a + b, 0);
          const isExpanded = expandedRows[ch.ch];
          const isSelected = selectedChannel === ch.ch;
          const isAnomaly = rate < 1 && ch.uploaded > 70;

          return (
            <div key={ch.ch}>
              <div
                className={`ch-row${isAnomaly ? " anomaly" : ""}${isSelected ? " selected-row" : ""}`}
                onClick={() => onRowClick(ch)}
                style={compact ? { padding: '4px 12px' } : {}}
              >
                <span
                  style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 500, color: "var(--ink)", display: "flex", alignItems: "center", gap: 5 }}
                  className="ch-name"
                >
                  <span
                    className="row-expand-btn"
                    onClick={(e) => { e.stopPropagation(); setExpandedRows(prev => ({ ...prev, [ch.ch]: !prev[ch.ch] })); }}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  {ch.noPublish && <span className="pdot pdot-r" />}
                  Ch-{ch.ch}
                  {isSelected && <span style={{ fontSize: 8, color: 'var(--pri-lt)' }}>◈</span>}
                </span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="eff-bar" style={{ flex: 1 }}>
                      <div className="eff-fill" style={{ width: `${Math.min(rate * 5, 100)}%`, background: barColor }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: barColor, minWidth: 36, fontWeight: 600 }}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 500 }}>{ch.uploaded}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 500 }}>{ch.created}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 500, color: ch.published === 0 ? "var(--dan-lt)" : "var(--ink)" }}>
                  {ch.published}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink3)" }}>
                  {platCount || "—"}
                </span>
              </div>

              {/* Expanded sub-row */}
              {isExpanded && (
                <div style={{ padding: '10px 12px 10px 48px', background: 'var(--bg3)', borderBottom: '1px solid var(--line-lt)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--ink4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>AI Multiplier</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{(ch.created / ch.uploaded).toFixed(1)}×</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--ink4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Pub Rate</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: barColor }}>{rate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--ink4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Hours</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>—</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--ink4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Platforms</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{platCount}</div>
                    </div>
                  </div>
                  {/* Platform chips */}
                  {Object.entries(ch.platforms || {}).filter(([, v]) => v > 0).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                      {Object.entries(ch.platforms).filter(([, v]) => v > 0).map(([plat, cnt]) => (
                        <span key={plat} className="f-chip">{plat}: {cnt}</span>
                      ))}
                    </div>
                  )}
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button className="explain-action">⇔ vs Ch-D</button>
                    <button className="explain-action">◈ Anchor context</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChannelTable;
