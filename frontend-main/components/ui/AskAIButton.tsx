function AskAIButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 5,
        padding: "7px 12px",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: "var(--gold)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        minHeight: 32,
      }}
    >
      ✦ Ask AI
    </button>
  );
}

export default AskAIButton;
