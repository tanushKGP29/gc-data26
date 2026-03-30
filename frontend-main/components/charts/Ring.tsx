// @ts-nocheck
function Ring({ pct, size = 70, color = "var(--pri)", label }) {
  const r = (size - 10) / 2,
    circ = 2 * Math.PI * r,
    offset = circ * (1 - pct / 100);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--sankey-bg)"
            strokeWidth="7"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)",
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: size > 65 ? 14 : 11,
              color: "var(--ink)",
              lineHeight: 1,
            }}
          >
            {pct}%
          </span>
        </div>
      </div>
      {label && (
        <span
          style={{
            fontSize: 8,
            fontFamily: "var(--font-mono)",
            color: "var(--ink3)",
            marginTop: 5,
            textAlign: "center",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default Ring;
