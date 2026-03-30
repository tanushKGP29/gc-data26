// @ts-nocheck
function ChannelPlatformHeatmap({ platforms = [], rows = [] }) {
  const plats = platforms;
  const maxVal = Math.max(0, ...rows.flatMap((row) => row.values || []));
  const theme = document.documentElement.getAttribute("data-theme");
  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `44px repeat(${plats.length},1fr)`,
          gap: 2,
          minWidth: 320,
          fontSize: 10,
          fontFamily: "var(--font-mono)",
        }}
      >
        <div />
        {plats.map((p) => (
          <div
            key={p}
            style={{
              textAlign: "center",
              color: "var(--ink3)",
              padding: "3px 0",
              fontSize: 9,
            }}
          >
            {p}
          </div>
        ))}
        {rows.map((rowItem) => {
          const row = rowItem.values;
          const ch = rowItem.channel.replace("Ch-", "");
          return [
            <div
              key={`lbl-${ch}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 6,
                color: "var(--ink3)",
                fontSize: 9,
              }}
            >
              Ch-{ch}
            </div>,
            ...row.map((v, i) => {
              const alpha = maxVal > 0 ? 0.12 + 0.78 * (v / maxVal) : 0.08;
              const bg =
                v > 0 ? `rgba(255,71,87,${alpha})` : `var(--sankey-bg)`;
              return (
                <div
                  key={`${ch}-${i}`}
                  style={{
                    height: 24,
                    background: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 2,
                    border: "1px solid var(--line-xs)",
                    color: v > 0 ? "var(--pri-lt)" : "var(--ink4)",
                    fontSize: 9,
                    cursor: "pointer",
                    transition: "opacity .1s",
                  }}
                  title={`Ch-${ch} × ${plats[i]}: ${v}`}
                >
                  {v > 0 ? v : ""}
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

export default ChannelPlatformHeatmap;
