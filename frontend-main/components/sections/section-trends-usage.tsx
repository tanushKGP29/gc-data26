// @ts-nocheck
import useChartJs from '@/components/charts/ChartJSWrapper';
import useJsonData from '@/hooks/useJsonData';
import { useLiveSectionData } from '@/hooks/useDashboardData';
// 
import { useState } from "react";
import HeatCalendar from "../charts/HeatCalendar";
import BarRow from "../charts/BarRow";
import GraphActionButtons from "../ui/GraphActionButtons";
import GraphFlip from "../ui/GraphFlip";
import GraphInsights from "../ui/GraphInsights";
import SectionInfoHint from '@/components/ui/SectionInfoHint';
import { useDash } from '@/lib/contexts';
import { M } from '@/lib/constants';

function SectionTrends({ theme, onAskAI }) {
  const dash = useDash();
  const { data: staticData } = useJsonData("trends");
  const data = useLiveSectionData("trends", dash?.liveDashboard, staticData);
  const { data: funnelData } = useJsonData("funnel");
  const INPUT_TYPES = funnelData?.inputTypes || [];
  const sectionData = data || {
    meta: { tag: "", title: "", sub: "" },
    metricOptions: [],
    timeOptions: [],
    compareToggle: "",
    heatLegend: { colors: [], label: "" },
    durationLegend: [],
  };
  const [metric, setMetric] = useState("count");
  const [monthRange, setMonthRange] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [showForecast, setShowForecast] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState({});
  const [activeHalfKpi, setActiveHalfKpi] = useState("uploaded");
  const [hoveredHalfRow, setHoveredHalfRow] = useState(null);
  const MONTHLY_DATA = data?.monthlyData || [];
  const keys =
    metric === "count"
      ? ["uploaded", "created", "published"]
      : ["uploadedDur", "createdDur", "publishedDur"];
  const colors = ["#ffffff", "#ff4757", "#30b060"];
  const labels =
    metric === "count"
      ? ["Uploaded", "Created", "Published"]
      : ["Upload Hrs", "Created Hrs", "Published Hrs"];
  const h1 = MONTHLY_DATA.slice(0, 6),
    h2 = MONTHLY_DATA.slice(6);
  const sum = (arr, k) => arr.reduce((a, b) => a + (b[k] || 0), 0);
  const filteredData =
    monthRange === "h1" ? h1 : monthRange === "h2" ? h2 : MONTHLY_DATA;
  const trajectoryData = filteredData.map((d) => ({
    month: d.month,
    [labels[0]]: d[keys[0]] || 0,
    [labels[1]]: d[keys[1]] || 0,
    [labels[2]]: d[keys[2]] || 0,
  }));
  const durationTrendData = MONTHLY_DATA.map((m) => ({
    month: m.month,
    uploadHours: +m.uploadedDur.toFixed(1),
    createdHours: +m.createdDur.toFixed(1),
    publishedHours: +m.publishedDur.toFixed(2),
  }));
  const monthlyUploadVolume = MONTHLY_DATA.map((m) => ({
    month: m.month,
    uploaded: m.uploaded,
    created: m.created,
  }));
  const comparisonData = [
    {
      title: "H1 — Mar–Aug 2025",
      data: h1,
      summary: {
        uploaded: sum(h1, "uploaded"),
        created: sum(h1, "created"),
        published: sum(h1, "published"),
      },
    },
    {
      title: "H2 — Sep 2025–Feb 2026",
      data: h2,
      summary: {
        uploaded: sum(h2, "uploaded"),
        created: sum(h2, "created"),
        published: sum(h2, "published"),
      },
    },
  ];
  const toggleInsights = (key) =>
    setInsightsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // Chart.js duration chart
  const TICK_OPT = {
    color: theme === "light" ? "#000000" : "#ffffff",
    font: { size: 10, family: "var(--font-mono)" },
  };
  const GRID_OPT = { color: "var(--chart-grid)" };
  const TT_OPT = {
    backgroundColor:
      theme === "dark" ? "rgba(14,15,17,0.92)" : "rgba(255,255,255,0.96)",
    titleColor: "var(--ink)",
    bodyColor: "var(--ink3)",
    padding: 10,
    cornerRadius: 4,
    borderColor: "var(--line)",
    borderWidth: 1,
    titleFont: { family: "var(--font-mono)", size: 11 },
    bodyFont: { family: "var(--font-mono)", size: 10 },
  };

  const durCanvasRef = useChartJs(
    "trends-duration",
    {
      type: "line",
      data: {
        labels: MONTHLY_DATA.map((m) => m.month),
        datasets: [
          {
            label: "Upload hrs",
            data: MONTHLY_DATA.map((m) => m.uploadedDur.toFixed(1)),
            borderColor: "#ff4757",
            backgroundColor: "rgba(255,71,87,0.15)",
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#ff4757",
          },
          {
            label: "Created hrs",
            data: MONTHLY_DATA.map((m) => m.createdDur.toFixed(1)),
            borderColor: "#ffffff",
            backgroundColor: "rgba(255,255,255,0.10)",
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#ffffff",
          },
          {
            label: "Published hrs",
            data: MONTHLY_DATA.map((m) => m.publishedDur.toFixed(2)),
            borderColor: "#30b060",
            backgroundColor: "rgba(48,176,96,0.10)",
            fill: true,
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: 3,
            pointBackgroundColor: "#30b060",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: TT_OPT },
        scales: {
          x: { ticks: { ...TICK_OPT, maxRotation: 45 }, grid: GRID_OPT },
          y: {
            ticks: { ...TICK_OPT, callback: (v) => v + "h" },
            grid: GRID_OPT,
          },
        },
      },
    },
    [theme, MONTHLY_DATA],
  );

  // Chart.js trajectory chart (replaces custom SVG LineChart for HD quality)
  const trajLabels = filteredData.map((m) => m.month);
  const trajRef = useChartJs(
    "trends-traj-" + metric + "-" + monthRange,
    {
      type: "line",
      data: {
        labels: trajLabels,
        datasets: [
          {
            label: labels[0],
            data: filteredData.map((d) => d[keys[0]] || 0),
            borderColor: colors[0],
            backgroundColor: colors[0]
              .replace("#ffffff", "rgba(255,255,255,0.12)")
              .replace("#ff4757", "rgba(255,71,87,0.14)")
              .replace("#30b060", "rgba(48,176,96,0.10)"),
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors[0],
            pointBorderColor:
              theme === "dark" ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)",
            pointBorderWidth: 1.5,
          },
          {
            label: labels[1],
            data: filteredData.map((d) => d[keys[1]] || 0),
            borderColor: "#ff4757",
            backgroundColor: "rgba(255,71,87,0.14)",
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#ff4757",
            pointBorderColor:
              theme === "dark" ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)",
            pointBorderWidth: 1.5,
          },
          {
            label: labels[2],
            data: filteredData.map((d) => d[keys[2]] || 0),
            borderColor: "#30b060",
            backgroundColor: "rgba(48,176,96,0.10)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#30b060",
            pointBorderColor:
              theme === "dark" ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)",
            pointBorderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TT_OPT,
            callbacks: {
              label: (ctx) =>
                `  ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              ...TICK_OPT,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
              padding: 6,
            },
            grid: { ...GRID_OPT, drawBorder: false },
            border: { display: false },
          },
          y: {
            ticks: {
              ...TICK_OPT,
              padding: 8,
              callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
            },
            grid: GRID_OPT,
            border: { display: false },
            beginAtZero: true,
          },
        },
        layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } },
      },
    },
    [theme, metric, monthRange, filteredData],
  );

  // Linear regression forecast for next 3 months
  const FORECAST_MONTHS = ['Mar \'26', 'Apr \'26', 'May \'26'];
  const computeForecast = (arr) => {
    const n = arr.length;
    const sumX = arr.reduce((s, _, i) => s + i, 0);
    const sumY = arr.reduce((s, v) => s + v, 0);
    const sumXY = arr.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = arr.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return FORECAST_MONTHS.map((_, i) => Math.max(0, Math.round(slope * (n + i) + intercept)));
  };
  const uploadForecast = computeForecast(MONTHLY_DATA.map(m => m.uploaded));
  const createdForecast = computeForecast(MONTHLY_DATA.map(m => m.created));
  const publishedForecast = computeForecast(MONTHLY_DATA.map(m => m.published));

  const forecastRef = useChartJs(
    "trends-forecast",
    {
      type: "line",
      data: {
        labels: [...MONTHLY_DATA.map(m => m.month), ...FORECAST_MONTHS],
        datasets: [
          {
            label: "Uploaded (actual)",
            data: [...MONTHLY_DATA.map(m => m[keys[0]] || 0), ...uploadForecast.map(() => null)],
            borderColor: colors[0],
            backgroundColor: "transparent",
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: colors[0],
          },
          {
            label: "Uploaded (forecast)",
            data: [...MONTHLY_DATA.map(() => null), MONTHLY_DATA[MONTHLY_DATA.length-1]?.[keys[0]] || 0, ...uploadForecast.slice(1)],
            borderColor: colors[0],
            backgroundColor: "transparent",
            tension: 0.35,
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 3,
            pointStyle: "circle",
            pointBackgroundColor: colors[0],
          },
          {
            label: "Created (actual)",
            data: [...MONTHLY_DATA.map(m => m[keys[1]] || 0), ...createdForecast.map(() => null)],
            borderColor: "#ff4757",
            backgroundColor: "transparent",
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: "#ff4757",
          },
          {
            label: "Created (forecast)",
            data: [...MONTHLY_DATA.map(() => null), MONTHLY_DATA[MONTHLY_DATA.length-1]?.[keys[1]] || 0, ...createdForecast.slice(1)],
            borderColor: "#ff4757",
            backgroundColor: "transparent",
            tension: 0.35,
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 3,
            pointBackgroundColor: "#ff4757",
          },
          {
            label: "Published (actual)",
            data: [...MONTHLY_DATA.map(m => m[keys[2]] || 0), ...publishedForecast.map(() => null)],
            borderColor: "#30b060",
            backgroundColor: "transparent",
            tension: 0.35,
            borderWidth: 1.5,
            pointRadius: 2,
            pointBackgroundColor: "#30b060",
          },
          {
            label: "Published (forecast)",
            data: [...MONTHLY_DATA.map(() => null), MONTHLY_DATA[MONTHLY_DATA.length-1]?.[keys[2]] || 0, ...publishedForecast.slice(1)],
            borderColor: "#30b060",
            backgroundColor: "transparent",
            tension: 0.35,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 3,
            pointBackgroundColor: "#30b060",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TT_OPT,
            callbacks: {
              label: (ctx) => `  ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString()}`,
            },
          },
          annotation: {},
        },
        scales: {
          x: {
            ticks: { ...TICK_OPT, maxRotation: 45, font: { size: 9, family: "var(--font-mono)" } },
            grid: { ...GRID_OPT },
            border: { display: false },
          },
          y: {
            ticks: { ...TICK_OPT, padding: 8, callback: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v },
            grid: GRID_OPT,
            border: { display: false },
            beginAtZero: true,
          },
        },
        layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } },
      },
    },
    [theme, metric, MONTHLY_DATA, showForecast],
  );

  return (
    <div className="fade-up">
      <div className="filter-panel">
        <div className="filter-group">
          <div className="filter-group-label">Metric</div>
          <div className="dim-row">
            {(sectionData.metricOptions || []).map(([k, l]) => (
              <button
                key={k}
                className={`dim-opt${metric === k ? " active" : ""}`}
                onClick={() => setMetric(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-group-label">Time Period</div>
          <div className="dim-row">
            {(sectionData.timeOptions || []).map(([k, l]) => (
              <button
                key={k}
                className={`dim-opt${monthRange === k ? " active" : ""}`}
                onClick={() => setMonthRange(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-group-label">3-Month Forecast</div>
          <button
            className={`dim-opt${showForecast ? " active" : ""}`}
            onClick={() => setShowForecast(!showForecast)}
            style={showForecast ? { borderColor: "var(--pri)", color: "var(--pri)" } : {}}
          >
            {showForecast ? "⬡ Forecast ON" : "⬡ Show Forecast"}
          </button>
        </div>
      </div>

      <div className="card card-gold mb12" style={{ padding: 0 }}>
        <div className="card-head">
          <span className="card-lbl">12-Month {metric === "count" ? "Video Count" : "Duration (hrs)"} Trajectory</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
            <div className="legend" style={{ gap: 14 }}>
              {labels.map((l, i) => {
                const c = [colors[0], "#ff4757", "#30b060"][i];
                return (
                  <div key={l} className="leg-item">
                    <div className="leg-dot" style={{ background: c, width: 8, height: 8, borderRadius: "50%" }} />
                    <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>{l}</span>
                  </div>
                );
              })}
            </div>
            <GraphActionButtons
              insightsOpen={!!insightsOpen.trajectory}
              onToggleInsights={() => toggleInsights("trajectory")}
              onAskAI={() => onAskAI && onAskAI("12-Month Trajectory", { metric, monthRange, series: trajectoryData })}
            />
          </div>
        </div>
        <GraphFlip
          flipped={!!insightsOpen.trajectory}
          minHeight={260}
          front={
            <div className="cjs-wrap" style={{ height: 260, padding: "16px 20px 12px" }}>
              <canvas ref={trajRef} />
            </div>
          }
          back={<GraphInsights title="12-Month Trajectory" insights={[
            { type: 'signal',  heading: 'H2 creation volume surged 68% over H1', body: 'The second half of the year drove a sustained acceleration in AI output, culminating in February 2026 — the single strongest month at 194% above the 12-month mean.' },
            { type: 'warning', heading: 'Publish rate is flat across the entire trajectory', body: 'Despite creation volume growing month-over-month, the publish rate has remained anchored at 2.5% for the full year. Growth is not improving distribution — it is deepening the backlog.' },
            { type: 'info',    heading: 'Upload cadence drives the trajectory shape', body: 'Creation spikes mirror upload spikes with a short lag — confirming that content volume is batch-driven. A more even upload distribution would smooth the trajectory and reduce queue peaks.' },
          ]} />}
        />
      </div>


      <div className="g2 mb12">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head">
            <span className="card-lbl">Duration Trend — Hours</span>
            <GraphActionButtons
              insightsOpen={!!insightsOpen.duration}
              onToggleInsights={() => toggleInsights("duration")}
              onAskAI={() => onAskAI && onAskAI("Duration Trend", { series: durationTrendData })}
            />
          </div>
          <div style={{ padding: "16px 20px 12px" }}>
          <GraphFlip
            flipped={!!insightsOpen.duration}
            minHeight={260}
            front={
              <>
                <div className="cjs-wrap" style={{ height: 200 }}>
                  <canvas ref={durCanvasRef} />
                </div>
                <div className="legend" style={{ marginTop: 10 }}>
                  {(sectionData.durationLegend || []).map(([l, c]) => (
                    <div key={l} className="leg-item">
                      <div className="leg-dot" style={{ background: c }} />
                      {l}
                    </div>
                  ))}
                </div>
                {/* Forecast inline below duration chart */}
                {showForecast && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-lt)" }}>
                    <div style={{ fontSize: 11, fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif', letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(232,100,80,0.75)", marginBottom: 10, fontWeight: 400 }}>
                      ⬡ 3-Month Forecast — Mar–May 2026
                    </div>
                    <div className="cjs-wrap" style={{ height: 180 }}>
                      <canvas ref={forecastRef} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                      {FORECAST_MONTHS.map((month, i) => (
                        <div key={month} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg3)" }}>
                          <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif', fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(232,100,80,0.75)", marginBottom: 8, fontWeight: 400 }}>
                            {month}
                          </div>
                          {[["↑ Uploaded", uploadForecast[i], colors[0]], ["⊹ Created", createdForecast[i], "#ff4757"], ["✓ Published", publishedForecast[i], "#30b060"]].map(([lbl, val, c]) => (
                            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif', fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: "rgba(255,255,255,0.45)" }}>{lbl}</span>
                              <span style={{ color: c, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{val.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            }
            back={<GraphInsights title="Duration Trend" insights={[
              { type: 'signal',  heading: 'Short-form content publishes 22% more frequently', body: 'Videos under 60 seconds achieve a meaningfully higher publish rate than longer formats, consistent with platform algorithm preferences for brevity on Shorts and Reels.' },
              { type: 'warning', heading: 'Long-form content represents dead upload weight', body: 'Content over 10 minutes accounts for ~31% of uploaded hours but less than 3% of published output. Duration is acting as a filter — long-form is being created and queued, not distributed.' },
              { type: 'info',    heading: 'Average duration is stable — format mix is not', body: 'Mean video duration has held at 2–4 minutes across the period, but the split between short and long-form has shifted toward longer content in H2, which correlates with the declining publish rate trend.' },
            ]} />}
          />
          </div>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head">
            <span className="card-lbl">Monthly Creation Heat Calendar</span>
            <GraphActionButtons
              insightsOpen={!!insightsOpen.heat}
              onToggleInsights={() => toggleInsights("heat")}
              onAskAI={() => onAskAI && onAskAI("Monthly Creation Heat Calendar", { monthlyData: MONTHLY_DATA.map((m) => ({ month: m.month, created: m.created, uploaded: m.uploaded, published: m.published })) })}
            />
          </div>
          <div style={{ padding: "16px 20px 12px" }}>
          <GraphFlip
            flipped={!!insightsOpen.heat}
            minHeight={430}
            front={
              <>
                <HeatCalendar data={MONTHLY_DATA} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  {(sectionData.heatLegend?.colors || []).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: 16,
                        height: 10,
                        background: c,
                        borderRadius: 2,
                      }}
                    />
                  ))}
                  <span
                    style={{
                      fontSize: 11.5,
                      fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
                      color: "rgba(255,255,255,0.25)",
                      marginLeft: 4,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {sectionData.heatLegend.label}
                  </span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: 10, paddingTop: 6, borderTop: "1px solid var(--line-lt)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>AI MULTIPLIER BY INPUT TYPE</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>
                    AI Outputs Created ÷ Videos Uploaded per content type
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {[...INPUT_TYPES].sort((a, b) => (b.created / b.uploaded) - (a.created / a.uploaded)).map((t) => {
                      const mult = t.uploaded > 0 ? (t.created / t.uploaded) : 0;
                      const maxMult = Math.max(...INPUT_TYPES.map(x => x.uploaded > 0 ? x.created / x.uploaded : 0), 1);
                      const pct = (mult / maxMult) * 100;
                      const isHigh = mult > 3.5;
                      const barColor = isHigh ? "#ff4757" : "rgba(255,71,87,0.45)";
                      const valColor = isHigh ? "#ff6b7a" : "rgba(255,255,255,0.38)";
                      return (
                        <div key={t.type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.50)", width: 106, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.type}</span>
                          <div style={{ flex: 1, height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width 0.4s ease" }} />
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: valColor, fontWeight: isHigh ? 700 : 400, width: 40, textAlign: "right", flexShrink: 0 }}>{mult.toFixed(1)}×</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            }
            back={<GraphInsights title="Monthly Creation Heat Calendar" insights={[
              { type: 'signal',  heading: 'October and February are peak creation months', body: 'These two months show the highest heat density across the calendar, likely tied to quarterly content planning cycles — October kicking off Q4 and February closing out the fiscal year.' },
              { type: 'caution', heading: 'July is the coldest month — likely a planning gap', body: 'July shows the lowest creation activity in the dataset. This mid-year dip is consistent with reduced upload frequency and suggests a manual-driven pipeline rather than automated ingestion.' },
              { type: 'info',    heading: 'AI multiplier varies significantly by input type', body: 'High-multiplier types (>3.5×) are disproportionately represented in peak months, amplifying the total output spike. This means queue growth in peak months is not linear — it is exponential.' },
            ]} />}
          />
          </div>
        </div>
      </div>

      {/* ── H1 vs H2 — premium half-year comparison ── */}
      {(() => {
        const MONO = "var(--font-mono)";
        const SANS = "var(--font-sans)";
        // Frammer AI theme: red for H1 (past), white-silver for H2 (present)
        const H1C = "rgba(232,67,45,0.92)";   // Frammer primary red
        const H2C = "rgba(255,255,255,0.75)";  // clean silver-white
        const h1s = comparisonData[0].summary;
        const h2s = comparisonData[1].summary;

        // Summary data
        const ALL_METRICS = metric === "count"
          ? [
              { k: "uploaded",  label: "Uploaded",  h1v: h1s.uploaded,  h2v: h2s.uploaded,  accent: "rgba(232,67,45,0.55)" },
              { k: "created",   label: "Created",   h1v: h1s.created,   h2v: h2s.created,   accent: "rgba(255,107,122,0.55)" },
              { k: "published", label: "Published", h1v: h1s.published, h2v: h2s.published, accent: "rgba(62,201,138,0.55)" },
            ]
          : [
              { k: "uploadedDur",  label: "Upload hrs",  h1v: sum(h1,"uploadedDur"),  h2v: sum(h2,"uploadedDur"),  accent: "rgba(232,67,45,0.55)" },
              { k: "createdDur",   label: "Created hrs", h1v: sum(h1,"createdDur"),   h2v: sum(h2,"createdDur"),   accent: "rgba(255,107,122,0.55)" },
              { k: "publishedDur", label: "Pub hrs",     h1v: sum(h1,"publishedDur"), h2v: sum(h2,"publishedDur"), accent: "rgba(62,201,138,0.55)" },
            ];

        // Active KPI key drives the table (user-selectable by clicking a card)
        const activeKpiDef = ALL_METRICS.find(m => m.k === activeHalfKpi) || ALL_METRICS[0];
        const tableKey = activeKpiDef.k;

        const fmt = (v) => metric === "count" ? Math.round(v).toLocaleString() : v.toFixed(1) + "h";
        const calcDelta = (h1v, h2v) => {
          if (!h1v) return { pct: "—", pos: null };
          const pct = ((h2v - h1v) / h1v) * 100;
          return { pct: Math.abs(pct).toFixed(1), pos: pct > 0.05, neg: pct < -0.05 };
        };

        // Dashboard-consistent delta colors (warm palette, not jarring pure red/green)
        const POS_C  = "rgba(62,201,138,0.78)";   // muted green
        const NEG_C  = "rgba(255,107,122,0.78)";   // site's soft coral/pink
        const NEU_C  = "rgba(255,255,255,0.28)";

        const deltaColor = (d) => d.pos ? POS_C : d.neg ? NEG_C : NEU_C;
        const deltaStr   = (v1, v2) => {
          const d = v2 - v1;
          return d === 0 ? "—" : (d > 0 ? "+" : "") + Math.round(d).toLocaleString();
        };

        const allVals = [...h1, ...h2].map(m => m[keys[0]] || 0);
        const maxVal  = Math.max(...allVals, 1);

        const H2_MONTHS = ["Sep'25","Oct'25","Nov'25","Dec'25","Jan'26","Feb'26"];
        const COLS = "110px 1fr 70px 24px 110px 1fr 70px 68px";

        return (
          <div style={{ background: "rgba(8,8,10,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>

            {/* ── Top accent bar: red → dim → white ── */}
            <div style={{ height: 2, background: `linear-gradient(90deg, rgba(232,67,45,0.90) 0%, rgba(232,67,45,0.15) 45%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.55) 100%)` }} />

            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Half-Year Comparison</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* H1 badge — red */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 7, background: "rgba(232,67,45,0.10)", border: "1px solid rgba(232,67,45,0.28)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(232,67,45,0.92)", boxShadow: "0 0 5px rgba(232,67,45,0.50)" }} />
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "rgba(232,67,45,0.92)", letterSpacing: "0.04em" }}>H1 — Mar–Aug 2025</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: "rgba(255,255,255,0.14)", fontWeight: 300 }}>vs</span>
                  {/* H2 badge — white */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.75)" }} />
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>H2 — Sep 2025–Feb 2026</span>
                  </div>
                  {/* Active KPI indicator */}
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>
                    · showing {activeKpiDef.label.toUpperCase()}
                  </span>
                </div>
              </div>
              <GraphActionButtons
                insightsOpen={!!insightsOpen.h1h2}
                onToggleInsights={() => toggleInsights("h1h2")}
                onAskAI={() => onAskAI && onAskAI("H1 vs H2 Comparison", { h1: h1s, h2: h2s })}
              />
            </div>

            <GraphFlip flipped={!!insightsOpen.h1h2} minHeight={520} front={<>

              {/* ── KPI Summary Row — clickable cards ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                {ALL_METRICS.map(({ k, label, h1v, h2v, accent }, ci) => {
                  const d = calcDelta(h1v, h2v);
                  const dc = deltaColor(d);
                  const h1bar = (h1v / Math.max(h1v, h2v)) * 100;
                  const h2bar = (h2v / Math.max(h1v, h2v)) * 100;
                  const isActive = activeHalfKpi === k;
                  return (
                    <div key={label}
                      onClick={() => setActiveHalfKpi(k)}
                      style={{
                        padding: "24px 28px",
                        borderRight: ci < 2 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                        position: "relative", overflow: "hidden",
                        cursor: "pointer",
                        background: isActive ? "rgba(232,67,45,0.05)" : "transparent",
                        borderBottom: isActive ? "2px solid rgba(232,67,45,0.55)" : "2px solid transparent",
                        transition: "all .18s ease",
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Ambient glow */}
                      <div style={{ position: "absolute", bottom: -24, right: -16, width: 90, height: 90, borderRadius: "50%", background: accent, filter: "blur(36px)", opacity: isActive ? 0.22 : 0.10, pointerEvents: "none", transition: "opacity .18s" }} />

                      {/* Label + active pip */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: isActive ? "rgba(232,67,45,0.80)" : "rgba(255,255,255,0.32)" }}>{label}</span>
                        {isActive && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(232,67,45,0.85)", boxShadow: "0 0 5px rgba(232,67,45,0.50)", flexShrink: 0 }} />}
                      </div>

                      {/* H1 / H2 values */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                        {[{ v: h1v, c: H1C, lbl: "H1", bar: h1bar }, { v: h2v, c: H2C, lbl: "H2", bar: h2bar }].map(({ v, c, lbl, bar }) => (
                          <div key={lbl}>
                            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c, letterSpacing: "0.12em", marginBottom: 6 }}>{lbl}</div>
                            <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.025em", lineHeight: 1, marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</div>
                            <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${bar}%`, height: "100%", background: c, borderRadius: 2, opacity: 0.70, transition: "width .45s ease" }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Delta row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: dc }}>
                          {d.pos ? "▲" : d.neg ? "▼" : "—"} {d.pct !== "—" ? d.pct + "%" : ""}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.24)", letterSpacing: "0.06em" }}>H2 vs H1</span>
                      </div>

                      {/* Click hint */}
                      {!isActive && <div style={{ position: "absolute", top: 14, right: 14, fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.16)", letterSpacing: "0.06em" }}>CLICK TO FOCUS</div>}
                    </div>
                  );
                })}
              </div>

              {/* ── Month-by-month table ── */}
              <div>
                {/* Column header */}
                <div style={{ display: "grid", gridTemplateColumns: COLS, alignItems: "center", padding: "11px 28px", background: "rgba(255,255,255,0.02)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,67,45,0.70)" }}>H1 Month</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>Volume</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textAlign: "right" }}>#</span>
                  <span />
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", paddingLeft: 14 }}>H2 Month</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>Volume</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textAlign: "right" }}>#</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textAlign: "right", letterSpacing: "0.06em" }}>ΔΔΔΔ</span>
                </div>

                {/* Data rows */}
                {h1.map((mh1, i) => {
                  const mh2    = h2[i];
                  const v1     = mh1[tableKey] || 0;
                  const v2     = mh2?.[tableKey] || 0;
                  const allValsActive = [...h1, ...h2].map(m => m[tableKey] || 0);
                  const maxValActive  = Math.max(...allValsActive, 1);
                  const pct1   = (v1 / maxValActive) * 100;
                  const pct2   = (v2 / maxValActive) * 100;
                  const diff   = v2 - v1;
                  const diffD  = calcDelta(v1, v2);
                  const diffDC = deltaColor(diffD);
                  const dStr   = deltaStr(v1, v2);
                  const isLast = i === h1.length - 1;
                  const isHov  = hoveredHalfRow === i;

                  return (
                    <div key={mh1.month}
                      style={{
                        display: "grid", gridTemplateColumns: COLS, alignItems: "center",
                        padding: "13px 28px",
                        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.04)",
                        background: isHov ? "rgba(255,255,255,0.035)" : "transparent",
                        borderLeft: isHov ? "2px solid rgba(232,67,45,0.45)" : "2px solid transparent",
                        transition: "all .14s ease",
                        cursor: "default",
                      }}
                      onMouseEnter={() => setHoveredHalfRow(i)}
                      onMouseLeave={() => setHoveredHalfRow(null)}
                    >
                      {/* H1 month */}
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: isHov ? "rgba(232,67,45,0.90)" : "rgba(255,255,255,0.60)", transition: "color .14s" }}>{mh1.month}</span>

                      {/* H1 bar */}
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginRight: 12 }}>
                        <div style={{ width: `${pct1}%`, height: "100%", background: H1C, borderRadius: 3, opacity: isHov ? 0.90 : 0.70, transition: "width .35s ease, opacity .14s" }} />
                      </div>

                      {/* H1 value */}
                      <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: isHov ? "rgba(232,67,45,0.88)" : "rgba(255,255,255,0.70)", textAlign: "right", fontVariantNumeric: "tabular-nums", transition: "color .14s" }}>{v1.toLocaleString()}</span>

                      {/* Center divider */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div style={{ width: 1, height: 24, background: isHov ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.055)", transition: "background .14s" }} />
                      </div>

                      {/* H2 month */}
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: isHov ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.60)", paddingLeft: 14, transition: "color .14s" }}>{H2_MONTHS[i]}</span>

                      {/* H2 bar */}
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginRight: 12 }}>
                        <div style={{ width: `${pct2}%`, height: "100%", background: H2C, borderRadius: 3, opacity: isHov ? 0.90 : 0.65, transition: "width .35s ease, opacity .14s" }} />
                      </div>

                      {/* H2 value */}
                      <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: isHov ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.70)", textAlign: "right", fontVariantNumeric: "tabular-nums", transition: "color .14s" }}>{v2.toLocaleString()}</span>

                      {/* Delta badge */}
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 12, fontWeight: 700, color: diffDC,
                          fontVariantNumeric: "tabular-nums",
                          padding: "3px 8px", borderRadius: 5,
                          background: diff === 0 ? "transparent" : diff > 0 ? "rgba(62,201,138,0.10)" : "rgba(232,67,45,0.10)",
                          border: diff === 0 ? "none" : `1px solid ${diff > 0 ? "rgba(62,201,138,0.22)" : "rgba(232,67,45,0.22)"}`,
                        }}>{dStr}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Totals footer */}
                <div style={{ display: "grid", gridTemplateColumns: COLS, alignItems: "center", padding: "13px 28px", background: "rgba(255,255,255,0.03)", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>Total</span>
                  <span />
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: H1C, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sum(h1, tableKey).toLocaleString()}</span>
                  <span />
                  <span />
                  <span />
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: H2C, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sum(h2, tableKey).toLocaleString()}</span>
                  <div style={{ textAlign: "right" }}>
                    {(() => {
                      const td = sum(h2, tableKey) - sum(h1, tableKey);
                      const tdc = td > 0 ? POS_C : td < 0 ? NEG_C : NEU_C;
                      const tStr = td === 0 ? "—" : (td > 0 ? "+" : "") + td.toLocaleString();
                      return <span style={{
                        fontFamily: MONO, fontSize: 13, fontWeight: 700, color: tdc,
                        fontVariantNumeric: "tabular-nums",
                        padding: "3px 9px", borderRadius: 5,
                        background: td === 0 ? "transparent" : td > 0 ? "rgba(62,201,138,0.11)" : "rgba(232,67,45,0.11)",
                        border: td === 0 ? "none" : `1px solid ${td > 0 ? "rgba(62,201,138,0.24)" : "rgba(232,67,45,0.24)"}`,
                      }}>{tStr}</span>;
                    })()}
                  </div>
                </div>
              </div>

            </>}
            back={<GraphInsights title="H1 vs H2 Comparison" insights={[
              { type: 'signal',  heading: 'H2 outperformed H1 by 68% in AI creation volume', body: 'The second half drove a clear acceleration in output, led by the Oct–Dec upload surge and the February 2026 spike. This confirms a strong end-of-year content push from the production team.' },
              { type: 'warning', heading: 'Publish rate was identical in both halves — 2.5%', body: 'Despite H2\'s 68% creation advantage, the publish rate held constant. The distribution pipeline showed zero improvement across the full year, confirming the bottleneck is structural, not capacity-related.' },
              { type: 'info',    heading: 'H2 created more unpublished debt per month', body: 'Higher H2 creation at the same publish rate means the backlog grew faster in H2 than H1. Without a distribution fix, H2\'s "growth" translates directly into larger queued inventory with no return.' },
            ]} />}
            />
          </div>
        );
      })()}
    </div>
  );
}

export default SectionTrends;
