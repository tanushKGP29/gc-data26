// @ts-nocheck
import useChartJs from './ChartJSWrapper';

function StackedBarChart({ data, height = 200, theme = "dark" }) {
  const tickColor = theme === "light" ? "#111" : "rgba(245,245,247,0.65)";
  const gridColor = theme === "light" ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)";
  const tooltipBg = theme === "light" ? "rgba(255,255,255,0.97)" : "rgba(14,15,17,0.95)";

  const canvasRef = useChartJs(
    "stacked-bar-monthly-" + theme,
    {
      type: "bar",
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: "Uploaded",
            data: data.map(d => d.uploaded),
            backgroundColor: "rgba(255,71,87,0.75)",
            borderColor: "#ff4757",
            borderWidth: 1,
            borderRadius: 3,
            borderSkipped: false,
          },
          {
            label: "Created",
            data: data.map(d => d.created),
            backgroundColor: "rgba(255,71,87,0.28)",
            borderColor: "rgba(255,71,87,0.5)",
            borderWidth: 1,
            borderRadius: 3,
            borderSkipped: false,
          },
          {
            label: "Published",
            data: data.map(d => d.published),
            backgroundColor: "rgba(62,201,138,0.80)",
            borderColor: "#3EC98A",
            borderWidth: 1,
            borderRadius: 3,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: theme === "light" ? "#111" : "#f5f5f7",
            bodyColor: theme === "light" ? "#555" : "rgba(245,245,247,0.65)",
            padding: 10,
            cornerRadius: 5,
            borderColor: "rgba(255,71,87,0.25)",
            borderWidth: 1,
            titleFont: { family: "var(--font-ibm-plex-mono,monospace)", size: 11 },
            bodyFont: { family: "var(--font-ibm-plex-mono,monospace)", size: 10 },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, font: { size: 10, family: "var(--font-ibm-plex-mono,monospace)" }, maxRotation: 45 },
            grid: { color: gridColor },
            border: { display: false },
          },
          y: {
            ticks: {
              color: tickColor,
              font: { size: 10, family: "var(--font-ibm-plex-mono,monospace)" },
              callback: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v,
            },
            grid: { color: gridColor },
            border: { display: false },
            beginAtZero: true,
          },
        },
        layout: { padding: { top: 4, right: 8, bottom: 0, left: 4 } },
      },
    },
    [theme, data],
  );

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default StackedBarChart;
