// @ts-nocheck
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { standaloneAnalyze, type StandaloneAnalyzeResult, type DashboardData } from "@/lib/api";
import { useLiveSectionData } from "@/hooks/useDashboardData";
import Ring from "../charts/Ring";
import DonutChart from "../charts/DonutCharts";
import BarRow from "../charts/BarRow";
import dynamic from "next/dynamic";

const D3SankeyChart = dynamic(() => import("../charts/D3SankeyChart"), { ssr: false });

const SUB_TABS = [
  ["overview", "Overview"],
  ["trends", "Trends & Duration"],
  ["breakdown", "Breakdown & KPIs"],
];

const STORAGE_KEY = "frammer_analyze_result";

function loadCachedResult(): StandaloneAnalyzeResult | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveCachedResult(r: StandaloneAnalyzeResult | null) {
  try {
    if (r) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function AnalyzeToolPage() {
  const [theme, setTheme] = useState("dark");
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StandaloneAnalyzeResult | null>(() => loadCachedResult());
  const [subTab, setSubTab] = useState("overview");
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const dashboard: DashboardData | null = result
    ? { metrics: result.metrics || [], by_category: result.by_category || {}, chart_data: result.chart_data || {}, generated_at: new Date().toISOString() }
    : null;

  const execData = useLiveSectionData("executive", dashboard, null);
  const trendsData = useLiveSectionData("trends", dashboard, null);
  const funnelData = useLiveSectionData("funnel", dashboard, null);
  const explorerData = useLiveSectionData("explorer", dashboard, null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    setFiles((prev) => [...prev, ...arr]);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); handleFiles(e.dataTransfer.files); },
    [handleFiles]
  );

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleAnalyze = async () => {
    if (!files.length) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await standaloneAnalyze(files);
      if (!res.success) throw new Error(res.error || "Analysis failed");
      setResult(res);
      saveCachedResult(res);
      setSubTab("overview");
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    saveCachedResult(null);
  };

  const getVal = (id: string, def = 0): number => {
    if (!result?.metrics) return def;
    const met = result.metrics.find((m: any) => m.id === id);
    if (!met) return def;
    const v = met.value;
    return typeof v === "number" ? v : parseFloat(String(v)) || def;
  };

  const getFmt = (id: string, def = "\u2014"): string => {
    if (!result?.metrics) return def;
    const met = result.metrics.find((m: any) => m.id === id);
    return met?.formatted || def;
  };

  return (
    <div className="shell" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Spin keyframes */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Mini sidebar */}
      <div style={{ width: 232, minWidth: 232, background: "var(--bg2)", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Back link */}
        <a href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink4)", textDecoration: "none", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, transition: "color 0.15s", marginBottom: 18 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(232,67,45,0.8)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink4)")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          BACK TO DASHBOARD
        </a>

        {/* Branding */}
        <div style={{ padding: "12px 8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "rgba(232,67,45,0.7)", textTransform: "uppercase", marginBottom: 6 }}>◈ FRAMMER AI</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink)", lineHeight: 1.2, marginBottom: 5 }}>Upload & Analyze</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink4)", lineHeight: 1.55 }}>Isolated analysis sandbox — does not affect main dashboard.</div>
        </div>

        {/* Analysis tabs (when result is available) */}
        {result && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em", color: "var(--ink4)", textTransform: "uppercase", marginBottom: 8, paddingLeft: 8 }}>ANALYSIS VIEWS</div>
            {SUB_TABS.map(([k, l]) => (
              <div key={k}
                onClick={() => setSubTab(k)}
                style={{
                  cursor: "pointer", padding: "8px 10px", borderRadius: 7, marginBottom: 2,
                  background: subTab === k ? "rgba(232,67,45,0.09)" : "transparent",
                  border: subTab === k ? "1px solid rgba(232,67,45,0.2)" : "1px solid transparent",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (subTab !== k) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (subTab !== k) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: subTab === k ? "rgba(232,67,45,0.85)" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: subTab === k ? "rgba(255,255,255,0.85)" : "var(--ink4)", letterSpacing: "0.04em" }}>{l}</span>
              </div>
            ))}
          </div>
        )}

        {/* Datasets loaded (when result available) */}
        {result && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.14em", color: "var(--ink4)", textTransform: "uppercase", marginBottom: 8, paddingLeft: 8 }}>LOADED DATASETS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(result.files || []).map((f, i) => (
                <div key={i} style={{ padding: "7px 10px", background: "rgba(255,255,255,0.025)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{f.filename}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: f.status === "success" ? "rgba(48,201,120,0.8)" : "rgba(232,67,45,0.8)", display: "inline-block", padding: "1px 6px", background: f.status === "success" ? "rgba(48,201,120,0.08)" : "rgba(232,67,45,0.08)", borderRadius: 3 }}>
                    {f.classified_role || f.status}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleReset}
              style={{ marginTop: 12, width: "100%", padding: "8px", fontSize: 10, fontFamily: "var(--font-mono)", background: "transparent", border: "1px solid rgba(232,67,45,0.2)", color: "rgba(232,67,45,0.7)", borderRadius: 7, cursor: "pointer", letterSpacing: "0.1em", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(232,67,45,0.07)"; e.currentTarget.style.color = "rgba(232,67,45,0.95)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,67,45,0.7)"; }}
            >
              ↺ NEW UPLOAD
            </button>
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div className={`theme-toggle${theme === "light" ? " light" : ""}`} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} style={{ margin: "0 auto" }} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
        {/* Upload zone */}
        {!result && (
          <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 4px" }}>

            {/* Header */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "rgba(232,67,45,0.8)", textTransform: "uppercase", marginBottom: 10 }}>
                ◈ DATA INGESTION
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink)", lineHeight: 1.15, marginBottom: 8 }}>
                Upload Datasets
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink4)", lineHeight: 1.6 }}>
                Drop CSV or Excel files for isolated analysis — results stay sandboxed from the main dashboard.
              </div>
              {/* Format badges */}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {[".CSV", ".XLSX", ".XLS"].map(fmt => (
                  <div key={fmt} style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(232,67,45,0.75)", background: "rgba(232,67,45,0.07)", border: "1px solid rgba(232,67,45,0.18)", borderRadius: 4, padding: "3px 8px" }}>
                    {fmt}
                  </div>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? "1.5px solid rgba(232,67,45,0.7)" : "1.5px dashed rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: "52px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: isDragging
                  ? "rgba(232,67,45,0.045)"
                  : "linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
                transition: "all 0.22s ease",
                boxShadow: isDragging
                  ? "0 0 0 1px rgba(232,67,45,0.15), inset 0 0 40px rgba(232,67,45,0.03)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                if (!isDragging) {
                  e.currentTarget.style.borderColor = "rgba(232,67,45,0.35)";
                  e.currentTarget.style.background = "rgba(232,67,45,0.025)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isDragging) {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)";
                }
              }}
            >
              {/* Corner accents */}
              <div style={{ position: "absolute", top: 10, left: 10, width: 16, height: 16, borderTop: "1.5px solid rgba(232,67,45,0.35)", borderLeft: "1.5px solid rgba(232,67,45,0.35)", borderRadius: "2px 0 0 0" }} />
              <div style={{ position: "absolute", top: 10, right: 10, width: 16, height: 16, borderTop: "1.5px solid rgba(232,67,45,0.35)", borderRight: "1.5px solid rgba(232,67,45,0.35)", borderRadius: "0 2px 0 0" }} />
              <div style={{ position: "absolute", bottom: 10, left: 10, width: 16, height: 16, borderBottom: "1.5px solid rgba(232,67,45,0.35)", borderLeft: "1.5px solid rgba(232,67,45,0.35)", borderRadius: "0 0 0 2px" }} />
              <div style={{ position: "absolute", bottom: 10, right: 10, width: 16, height: 16, borderBottom: "1.5px solid rgba(232,67,45,0.35)", borderRight: "1.5px solid rgba(232,67,45,0.35)", borderRadius: "0 0 2px 0" }} />

              {/* Upload icon */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: isDragging ? "rgba(232,67,45,0.12)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${isDragging ? "rgba(232,67,45,0.4)" : "rgba(255,255,255,0.09)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.22s ease" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: isDragging ? 1 : 0.5, transition: "opacity 0.22s" }}>
                    <path d="M4 16.5C2.34 15.76 1 14.08 1 12C1 9.24 3.24 7 6 7C6.03 7 6.06 7 6.09 7C6.57 4.16 9.03 2 12 2C15.31 2 18 4.69 18 8C20.76 8 23 10.24 23 13C23 15.24 21.6 17.16 19.63 17.82" stroke="rgba(232,67,45,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 12L12 21" stroke="rgba(232,67,45,0.85)" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M9 15L12 12L15 15" stroke="rgba(232,67,45,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: isDragging ? "rgba(232,67,45,0.9)" : "rgba(255,255,255,0.55)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, transition: "color 0.22s" }}>
                {isDragging ? "Release to drop files" : "Drag & drop files here"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink4)", marginBottom: 16 }}>
                or{" "}
                <span style={{ color: "rgba(232,67,45,0.8)", borderBottom: "1px solid rgba(232,67,45,0.3)" }}>click to browse</span>
              </div>

              <input ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--ink4)", textTransform: "uppercase" }}>
                    QUEUED FILES <span style={{ color: "rgba(232,67,45,0.7)", marginLeft: 4 }}>({files.length})</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.025)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(232,67,45,0.2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                    >
                      {/* File type icon */}
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(232,67,45,0.08)", border: "1px solid rgba(232,67,45,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 2H6C5.46 2 4.96 2.21 4.59 2.59C4.21 2.96 4 3.46 4 4V20C4 20.54 4.21 21.04 4.59 21.41C4.96 21.79 5.46 22 6 22H18C18.54 22 19.04 21.79 19.41 21.41C19.79 21.04 20 20.54 20 20V8L14 2Z" stroke="rgba(232,67,45,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 2V8H20" stroke="rgba(232,67,45,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 13H16" stroke="rgba(232,67,45,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
                          <path d="M8 17H12" stroke="rgba(232,67,45,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink4)", marginTop: 2 }}>
                          {f.name.split(".").pop()?.toUpperCase()} · {(f.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        style={{ background: "rgba(232,67,45,0.07)", border: "1px solid rgba(232,67,45,0.15)", borderRadius: 6, color: "rgba(232,67,45,0.7)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(232,67,45,0.15)"; e.currentTarget.style.color = "rgba(232,67,45,1)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(232,67,45,0.07)"; e.currentTarget.style.color = "rgba(232,67,45,0.7)"; }}
                      >×</button>
                    </div>
                  ))}
                </div>

                {/* Analyze button */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  style={{
                    marginTop: 20, width: "100%", padding: "14px 20px",
                    fontSize: 12.5, fontFamily: "var(--font-mono)", fontWeight: 700,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    background: analyzing ? "rgba(255,255,255,0.04)" : "rgba(232,67,45,0.95)",
                    color: analyzing ? "var(--ink4)" : "#fff",
                    border: analyzing ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(232,67,45,0.5)",
                    borderRadius: 10,
                    cursor: analyzing ? "wait" : "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: analyzing ? "none" : "0 0 28px rgba(232,67,45,0.2), 0 2px 8px rgba(0,0,0,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  }}
                  onMouseEnter={(e) => { if (!analyzing) { e.currentTarget.style.background = "rgba(232,67,45,1)"; e.currentTarget.style.boxShadow = "0 0 36px rgba(232,67,45,0.32), 0 2px 12px rgba(0,0,0,0.4)"; }}}
                  onMouseLeave={(e) => { if (!analyzing) { e.currentTarget.style.background = "rgba(232,67,45,0.95)"; e.currentTarget.style.boxShadow = "0 0 28px rgba(232,67,45,0.2), 0 2px 8px rgba(0,0,0,0.3)"; }}}
                >
                  {analyzing ? (
                    <>
                      <span style={{ display: "inline-block", width: 14, height: 14, border: "1.5px solid rgba(255,255,255,0.15)", borderTopColor: "var(--ink4)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      ANALYZING DATASETS...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 12H18L15 21L9 3L6 12H2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      RUN ANALYSIS
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 16, padding: "13px 16px", background: "rgba(232,67,45,0.07)", border: "1px solid rgba(232,67,45,0.22)", borderRadius: 9, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(232,67,45,0.8)" strokeWidth="1.5"/>
                  <path d="M12 8V12" stroke="rgba(232,67,45,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1" fill="rgba(232,67,45,0.8)"/>
                </svg>
                <span style={{ color: "rgba(232,67,45,0.9)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5 }}>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {result && subTab === "overview" && <OverviewTab exec={execData} funnel={funnelData} getVal={getVal} getFmt={getFmt} result={result} theme={theme} />}
        {result && subTab === "trends" && <TrendsTab trends={trendsData} getVal={getVal} getFmt={getFmt} />}
        {result && subTab === "breakdown" && <BreakdownTab exec={execData} explorer={explorerData} result={result} />}
      </div>
    </div>
  );
}

/* ──────────────────── OVERVIEW TAB ──────────────────── */

function OverviewTab({ exec, funnel, getVal, getFmt, result, theme }: any) {
  if (!exec) return <EmptyState />;

  const kpis = [
    { label: "Total Uploaded", value: getFmt("total_uploaded"), color: "var(--ink)" },
    { label: "Total Created", value: getFmt("total_processed"), color: "var(--pri)" },
    { label: "Total Published", value: getFmt("total_published"), color: "var(--suc)" },
    { label: "Publish Rate", value: getFmt("publish_rate"), color: getVal("publish_rate") < 5 ? "var(--red-lt)" : "var(--suc)" },
    { label: "Amplification", value: getFmt("amplification_ratio"), color: "var(--amber)" },
    { label: "Channels", value: getFmt("distinct_channels"), color: "var(--ink3)" },
    { label: "Uploaded Hours", value: getFmt("uploaded_hours"), color: "var(--ink3)" },
    { label: "Published Hours", value: getFmt("published_hours"), color: "var(--ink3)" },
  ];

  const outputMix = exec.outputMix || [];
  const sankeyData = funnel?.sankey || {};

  return (
    <div className="fade-up">
      <SectionHeader tag="OVERVIEW" title="Dataset Summary" sub="Key metrics and content funnel from your uploaded datasets" />

      {/* File badges */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {(result.files || []).filter((f: any) => f.status === "success").map((f: any, i: number) => (
          <div key={i} style={{ padding: "8px 14px", background: "var(--bg3)", borderRadius: 6, border: "1px solid var(--line-lt)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink3)" }}>{f.filename}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--suc)", marginTop: 2 }}>
              {f.classified_role || "classified"}
              {result.dataset_info?.[f.classified_role] && ` \u00b7 ${result.dataset_info[f.classified_role].rows} rows`}
            </div>
          </div>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sankey funnel + Output donut */}
      <div className="g-6-4">
        {sankeyData.funnel?.nodes?.length > 0 && (
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>
              CONTENT FUNNEL FLOW
            </div>
            <div style={{ fontSize: 10, color: "var(--ink4)", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
              Uploads &rarr; AI Created &rarr; Published &rarr; Platforms
            </div>
            <D3SankeyChart type="funnel" theme={theme} dataMap={sankeyData} />
          </div>
        )}
        {outputMix.length > 0 && (
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>
              OUTPUT TYPE MIX
            </div>
            <DonutChart data={outputMix} size={200} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────── TRENDS TAB ──────────────────── */

function TrendsTab({ trends, getVal, getFmt }: any) {
  if (!trends?.monthlyData?.length) return <EmptyState msg="No monthly data available in uploaded datasets" />;

  const monthly = trends.monthlyData || [];
  const hasDur = monthly.some((m: any) => (m.uploadedDur || 0) > 0 || (m.createdDur || 0) > 0);
  const maxCount = Math.max(...monthly.map((m: any) => Math.max(m.uploaded || 0, m.created || 0)), 1);
  const maxDur = hasDur ? Math.max(...monthly.map((m: any) => Math.max(m.uploadedDur || 0, m.createdDur || 0)), 0.1) : 1;

  // Summary KPIs
  const totUp = monthly.reduce((s: number, m: any) => s + (m.uploaded || 0), 0);
  const totCr = monthly.reduce((s: number, m: any) => s + (m.created || 0), 0);
  const totPub = monthly.reduce((s: number, m: any) => s + (m.published || 0), 0);
  const totUpDur = monthly.reduce((s: number, m: any) => s + (m.uploadedDur || 0), 0);
  const totCrDur = monthly.reduce((s: number, m: any) => s + (m.createdDur || 0), 0);
  const totPubDur = monthly.reduce((s: number, m: any) => s + (m.publishedDur || 0), 0);

  return (
    <div className="fade-up">
      <SectionHeader tag="TRENDS & DURATION" title="Monthly Performance" sub="Counts, durations, and volume trajectory in a single view" />

      {/* Totals strip */}
      <div style={{ display: "grid", gridTemplateColumns: hasDur ? "repeat(6, 1fr)" : "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { l: "Total Uploaded", v: totUp.toLocaleString(), c: "var(--ink)" },
          { l: "Total Created", v: totCr.toLocaleString(), c: "var(--pri)" },
          { l: "Total Published", v: totPub.toLocaleString(), c: "var(--suc)" },
          ...(hasDur ? [
            { l: "Uploaded Hours", v: `${totUpDur.toFixed(1)}h`, c: "var(--ink3)" },
            { l: "Created Hours", v: `${totCrDur.toFixed(1)}h`, c: "var(--pri)" },
            { l: "Published Hours", v: `${totPubDur.toFixed(1)}h`, c: "var(--suc)" },
          ] : []),
        ].map((k) => (
          <div key={k.l} style={{ padding: "10px 14px", background: "var(--bg3)", borderRadius: 6, border: "1px solid var(--line-lt)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink4)", marginBottom: 4 }}>{k.l}</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: k.c, lineHeight: 1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Unified monthly table */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Month</th>
              <th>Uploaded</th>
              <th>Created</th>
              <th>Published</th>
              <th>Pub Rate</th>
              {hasDur && <th>Up Hrs</th>}
              {hasDur && <th>Cr Hrs</th>}
              {hasDur && <th>Pub Hrs</th>}
              <th style={{ width: "20%" }}>Volume</th>
              {hasDur && <th style={{ width: "15%" }}>Duration</th>}
            </tr>
          </thead>
          <tbody>
            {monthly.map((m: any, i: number) => (
              <tr key={i}>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{m.month}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{(m.uploaded || 0).toLocaleString()}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pri)" }}>{(m.created || 0).toLocaleString()}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--suc)" }}>{(m.published || 0).toLocaleString()}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: (m.created > 0 ? (m.published / m.created) * 100 : 0) < 2 ? "var(--red-lt)" : "var(--ink3)" }}>
                  {m.created > 0 ? ((m.published / m.created) * 100).toFixed(1) : "0.0"}%
                </td>
                {hasDur && <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink3)" }}>{(m.uploadedDur || 0).toFixed(1)}</td>}
                {hasDur && <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pri)" }}>{(m.createdDur || 0).toFixed(1)}</td>}
                {hasDur && <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--suc)" }}>{(m.publishedDur || 0).toFixed(1)}</td>}
                <td>
                  <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 18 }}>
                    <div style={{ width: 6, height: `${Math.max(2, ((m.uploaded || 0) / maxCount) * 18)}px`, background: "var(--ink3)", borderRadius: "2px 2px 0 0" }} />
                    <div style={{ width: 6, height: `${Math.max(2, ((m.created || 0) / maxCount) * 18)}px`, background: "var(--pri)", borderRadius: "2px 2px 0 0", opacity: 0.8 }} />
                    <div style={{ width: 6, height: `${Math.max(2, ((m.published || 0) / maxCount) * 18)}px`, background: "var(--suc)", borderRadius: "2px 2px 0 0" }} />
                  </div>
                </td>
                {hasDur && (
                  <td>
                    <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 18 }}>
                      <div style={{ width: 6, height: `${Math.max(2, ((m.uploadedDur || 0) / maxDur) * 18)}px`, background: "var(--ink3)", borderRadius: "2px 2px 0 0", opacity: 0.6 }} />
                      <div style={{ width: 6, height: `${Math.max(2, ((m.createdDur || 0) / maxDur) * 18)}px`, background: "var(--pri)", borderRadius: "2px 2px 0 0", opacity: 0.5 }} />
                      <div style={{ width: 6, height: `${Math.max(2, ((m.publishedDur || 0) / maxDur) * 18)}px`, background: "var(--suc)", borderRadius: "2px 2px 0 0", opacity: 0.6 }} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--line-lt)" }}>
          {[["Uploaded", "var(--ink3)"], ["Created", "var(--pri)"], ["Published", "var(--suc)"]].map(([l, c]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink4)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── BREAKDOWN TAB ──────────────────── */

function BreakdownTab({ exec, explorer, result }: any) {
  const channels = exec?.channels || [];
  const users = explorer?.users || exec?.users || [];
  const inputTypes = exec?.inputTypes || [];
  const metrics = result?.metrics || [];
  const hasData = channels.length || users.length || metrics.length;

  if (!hasData) return <EmptyState msg="No breakdown data available" />;

  // Build KPI framework from metrics
  const catLabels = {
    volume: "Volume & Scale", conversion: "Conversion & Publish",
    efficiency: "Efficiency", duration: "Duration",
    growth: "Growth & Trends", content_mix: "Content Mix",
    platform: "Platform", data_quality: "Data Quality",
  };
  const catColors: Record<string, string> = {
    volume: "rgba(255,255,255,0.75)", conversion: "rgba(232,67,45,0.9)", efficiency: "rgba(200,160,74,0.9)",
    duration: "rgba(255,255,255,0.45)", growth: "rgba(48,201,120,0.9)", content_mix: "rgba(232,67,45,0.9)",
    platform: "rgba(200,160,74,0.9)", data_quality: "rgba(232,67,45,0.75)",
  };
  const catBorderColors: Record<string, string> = {
    volume: "rgba(255,255,255,0.2)", conversion: "rgba(232,67,45,0.35)", efficiency: "rgba(200,160,74,0.35)",
    duration: "rgba(255,255,255,0.15)", growth: "rgba(48,201,120,0.35)", content_mix: "rgba(232,67,45,0.35)",
    platform: "rgba(200,160,74,0.35)", data_quality: "rgba(232,67,45,0.25)",
  };
  const grouped: Record<string, any[]> = {};
  for (const met of metrics) {
    const cat = met.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(met);
  }

  return (
    <div className="fade-up">
      <SectionHeader tag="BREAKDOWN & KPIS" title="Dimensional Analysis" sub="Channels, users, and full KPI framework" />

      {/* Channel table */}
      {channels.length > 0 && (
        <div className="card" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>
            CHANNELS ({channels.length})
          </div>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Channel</th><th>Uploaded</th><th>Created</th><th>Published</th><th>Rate</th><th>Amp</th></tr>
            </thead>
            <tbody>
              {channels.map((c: any) => (
                <tr key={c.ch}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Ch-{c.ch}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{c.uploaded.toLocaleString()}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pri)" }}>{c.created.toLocaleString()}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: c.published > 0 ? "var(--suc)" : "var(--red-lt)" }}>{c.published}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{c.rate?.toFixed(1)}%</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)" }}>{c.amp?.toFixed(1)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Users + Input types */}
      <div className="g2" style={{ marginBottom: 20 }}>
        {users.length > 0 && (
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>TOP USERS</div>
            {users.slice(0, 8).map((u: any) => (
              <BarRow key={u.user} label={u.user} value={u.created} max={Math.max(...users.map((x: any) => x.created))} fillClass="bf-rose" />
            ))}
          </div>
        )}
        {inputTypes.length > 0 && (
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>INPUT TYPES</div>
            {inputTypes.slice(0, 8).map((t: any) => (
              <BarRow key={t.type} label={t.type} value={t.created || t.uploaded} max={Math.max(...inputTypes.map((x: any) => x.created || x.uploaded))} fillClass="bf-gold" />
            ))}
          </div>
        )}
      </div>

      {/* KPI Framework */}
      {Object.keys(grouped).length > 0 && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pri)", marginBottom: 6 }}>KPI FRAMEWORK</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink)", marginBottom: 4 }}>Performance KPI Reference</div>
          <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 20 }}>All computed metrics from your uploaded datasets</div>

          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 6, borderBottom: `1.5px solid ${catBorderColors[cat] || "rgba(255,255,255,0.12)"}` }}>
                <div style={{ width: 3, height: 16, background: catColors[cat] || "var(--ink3)", borderRadius: 2 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: catColors[cat] || "var(--ink3)", fontWeight: 700 }}>
                  {catLabels[cat] || cat}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink4)" }}>({items.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {items.map((met: any) => (
                  <div key={met.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, border: "1px solid var(--line-lt)" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink2)", fontWeight: 500 }}>{met.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink4)", marginTop: 2 }}>{met.description}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: catColors[cat] || "var(--ink)", fontWeight: 400, flexShrink: 0, marginLeft: 12, textAlign: "right" }}>
                      {met.formatted}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────── SHARED ──────────────────── */

function SectionHeader({ tag, title, sub }: { tag: string; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--pri)", marginBottom: 6 }}>{tag}</div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--ink4)" }}>{sub}</div>
    </div>
  );
}

function EmptyState({ msg }: { msg?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--ink4)" }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>--</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{msg || "No data available for this view"}</div>
    </div>
  );
}
