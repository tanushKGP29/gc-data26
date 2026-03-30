// @ts-nocheck
function BarRow({ label, value, max, fillClass = "bf-gold", extra, onClick, selected } : any) {
  const pct = Math.max(1, (value / max) * 100);
  return (
    <div
      className="bar-row"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        ...(selected ? {
          background: 'var(--pri-dim)',
          border: '1px solid rgba(255,71,87,0.22)',
          borderRadius: 'var(--radius-sm)',
          padding: '3.5px 6px',
        } : {}),
      }}
    >
      <span className="bar-lbl" title={label} style={selected ? { color: 'var(--pri-lt)' } : {}}>
        {label}
      </span>
      <div className="bar-track">
        <div className={`bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-val">
        {typeof value === "number" ? value.toLocaleString() : value}
        {extra && (
          <span style={{ color: "var(--ink4)", marginLeft: 3 }}>{extra}</span>
        )}
      </span>
    </div>
  );
}

export default BarRow;
