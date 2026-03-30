function GraphActionButtons({ onToggleInsights, insightsOpen }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={onToggleInsights}
        style={{
          background: insightsOpen ? "var(--glow)" : "transparent",
          border: "1px solid var(--line)",
          borderRadius: 5,
          padding: "7px 12px",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: insightsOpen ? "var(--gold-lt)" : "var(--ink2)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          minHeight: 32,
        }}
      >
        ◫ {insightsOpen ? "Show Graph" : "Show Insights"}
      </button>
    </div>
  );
}

export default GraphActionButtons;
