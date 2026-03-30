// @ts-nocheck
function Sparkline({ data, max, color = "var(--pri)", h = 28 }) {
  return (
    <span
      className="sparkline"
      style={{
        height: h,
        display: "inline-flex",
        alignItems: "flex-end",
        gap: 2,
      }}
    >
      {data.map((v, i) => (
        <span
          key={i}
          className="sp-bar"
          style={{
            height: Math.max(3, (v / max) * h),
            background: color,
            width: 3,
            opacity: 0.45 + (v / max) * 0.55,
            borderRadius: "1px 1px 0 0",
          }}
        />
      ))}
    </span>
  );
}

export default Sparkline;
