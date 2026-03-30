/**
 * Backend API Client for Frammer Analytics
 *
 * This module provides functions to fetch data from the Python backend.
 * It supports both server-side and client-side fetching.
 */

const BACKEND_URL = "/api/proxy";

export interface MetricData {
  id: string;
  name: string;
  value: number | string;
  formatted: string;
  category: string;
  description?: string;
}

export interface DashboardData {
  metrics: MetricData[];
  by_category: Record<string, MetricData[]>;
  chart_data: Record<string, any>;
  generated_at: string;
  from_cache?: boolean;
}

export interface FrontendDashboard {
  executive: any;
  client: any;
  funnel: any;
  trends: any;
  explorer: any;
  multidim: any;
  raw_metrics?: MetricData[];
  raw_chart_data?: Record<string, any>;
}

/**
 * Fetch the full analytics dashboard from the backend
 */
export async function fetchAnalyticsDashboard(): Promise<DashboardData | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/analytics-dashboard`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Failed to fetch analytics dashboard:", e);
    return null;
  }
}

/**
 * Fetch dashboard data formatted for the frontend views
 */
export async function fetchFrontendDashboard(view?: string): Promise<FrontendDashboard | any | null> {
  try {
    const url = view
      ? `${BACKEND_URL}/frontend-dashboard?view=${view}`
      : `${BACKEND_URL}/frontend-dashboard`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Failed to fetch frontend dashboard:", e);
    return null;
  }
}

/**
 * Fetch specific metrics by category
 */
export async function fetchMetrics(category?: string): Promise<MetricData[]> {
  try {
    const url = category
      ? `${BACKEND_URL}/metrics?category=${category}`
      : `${BACKEND_URL}/metrics`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.metrics || [];
  } catch (e) {
    console.warn("Failed to fetch metrics:", e);
    return [];
  }
}

/**
 * Get a specific metric value by ID
 */
export function getMetricValue(metrics: MetricData[], id: string, defaultValue: number = 0): number {
  const metric = metrics.find(m => m.id === id);
  if (!metric) return defaultValue;
  const val = metric.value;
  return typeof val === "number" ? val : parseFloat(String(val)) || defaultValue;
}

/**
 * Get a formatted metric value by ID
 */
export function getMetricFormatted(metrics: MetricData[], id: string, defaultValue: string = "0"): string {
  const metric = metrics.find(m => m.id === id);
  return metric?.formatted || defaultValue;
}

/**
 * Fetch recommendations from the backend
 */
export async function fetchRecommendations(): Promise<any | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/recommendations`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Failed to fetch recommendations:", e);
    return null;
  }
}

/**
 * Check backend health
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Chat / Copilot ──

export interface ChatRequest {
  message: string;
  session_id?: string | null;
  mode?: string | null;
}

export interface ChatArtifact {
  type: string;
  title?: string;
  [key: string]: any;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  artifacts: ChatArtifact[];
  suggestions: string[];
}

/**
 * Send a message to the backend chat/copilot endpoint
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string | null,
  mode?: string | null,
): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId || null, mode: mode || null }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "Chat request failed");
    throw new Error(err);
  }
  return await res.json();
}

// ── Datasets ──

export interface DatasetInfo {
  id: string;
  name: string;
  filename: string;
  [key: string]: any;
}

// ── Lift model ──
export interface LiftScoreRequest {
  topic: string;
  hashtags: string[];
  region: string;
  language: string;
  engagement_score: number;
}

export interface LiftScoreResult {
  best_platform: string;
  probability: number;
  rankings: { platform: string; probability: number }[];
  meta?: any;
}

export async function fetchLiftScore(payload: LiftScoreRequest): Promise<LiftScoreResult | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/lift/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: payload }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result as LiftScoreResult;
  } catch (e) {
    console.warn("Failed to fetch lift score", e);
    return null;
  }
}

/**
 * List all registered datasets
 */
export async function fetchDatasets(): Promise<DatasetInfo[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/datasets`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.datasets || [];
  } catch {
    return [];
  }
}

/**
 * Fetch dataset lineage (source files, roles, merges)
 */
export async function fetchDatasetLineage(): Promise<any | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/datasets/lineage`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Delete a dataset file
 */
export async function deleteDataset(filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/datasets/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get active mode (main vs standalone)
 */
export async function fetchActiveMode(): Promise<any | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/active-mode`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Restore main dashboard from standalone mode
 */
export async function restoreMainDashboard(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/restore-main-dashboard`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Standalone Analyze (Isolated Tool) ──

export interface StandaloneAnalyzeResult {
  success: boolean;
  error?: string;
  files: { filename: string; status: string; classified_role?: string; error?: string; columns?: string[] }[];
  metrics: MetricData[];
  by_category: Record<string, MetricData[]>;
  chart_data: Record<string, any>;
  dataset_info: Record<string, { filename: string; rows: number; columns: string[] }>;
  uploaded_filenames: string[];
  classified_roles: string[];
  available_roles?: string[];
}

/**
 * Upload and analyze files in isolation - does NOT affect main dashboard.
 * Returns analytics results directly for display in the Analyze Tool tab.
 */
export async function standaloneAnalyze(files: File[]): Promise<StandaloneAnalyzeResult> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${BACKEND_URL}/standalone-analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(err.detail || "Analysis failed");
  }

  return await res.json();
}
