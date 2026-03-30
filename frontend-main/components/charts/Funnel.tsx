// @ts-nocheck
function PublishFunnel({ uploaded, created, published }) {
  // Use created as the reference max since it's the largest value
  const maxVal = Math.max(uploaded, created, published);
  const stages = [
    {
      name: "Uploaded",
      count: uploaded,
      color: "var(--ink3)",
      pct: (uploaded / maxVal) * 100,
    },
    {
      name: "Processed",
      count: created,
      color: "var(--gold)",
      pct: (created / maxVal) * 100,
    },
    {
      name: "Published",
      count: published,
      color: "var(--amber)",
      pct: Math.max((published / maxVal) * 100, published > 0 ? 1.5 : 0),
    },
  ];
  return (
    <div>
      {stages.map((s, i) => {
        const dropPct =
          i > 0 ? (1 - stages[i].count / stages[i - 1].count) * 100 : 0;
        const dropPositive = dropPct > 0;
        return (
          <div key={s.name} className="funnel-stage">
            <div className="f-head">
              <span className="f-name">{s.name}</span>
              <span className="f-cnt">{s.count.toLocaleString()}</span>
            </div>
            <div
              style={{
                height: 14,
                background: "var(--sankey-bg)",
                border: "1px solid var(--line-lt)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${s.pct}%`,
                  background: s.color,
                  borderRadius: 2,
                  transition: "width 0.55s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>
            {i > 0 && (
              <div
                className="f-drop"
                style={{
                  color: dropPositive ? "var(--red-lt)" : "var(--green-lt)",
                }}
              >
                {dropPositive
                  ? `▼ ${dropPct.toFixed(1)}% drop from ${stages[i - 1].name}`
                  : `▲ ${Math.abs(dropPct).toFixed(0)}% expansion from ${stages[i - 1].name}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PublishFunnel;
