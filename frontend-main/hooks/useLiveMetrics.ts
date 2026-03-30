"use client";

import { useEffect, useState } from "react";
import { fetchAnalyticsDashboard, type MetricData, type DashboardData } from "@/lib/api";
import { M } from "@/lib/constants";

export interface LiveMetrics {
  uploaded: number;
  created: number;
  published: number;
  unpublished: number;
  publishRate: number;
  unpubRate: number;
  multiplier: number;
  uploadHrs: number;
  createdHrs: number;
  activeChannels: number;
  activeUsers: number;
  zeroPubMonths: number;
  peakMonth: string;
  peakCreated: number;
  topCh: string;
  topChPub: number;
  topChRate: number;
}

/**
 * Fetch dashboard from API, fall back to static file, fall back to null.
 */
async function loadDashboard(): Promise<DashboardData | null> {
  // Try backend API first
  const apiData = await fetchAnalyticsDashboard();
  if (apiData && apiData.metrics && apiData.metrics.length > 0) return apiData;

  // Fallback: static file from public/data/ (written by backend pipeline)
  try {
    const res = await fetch("/data/analytics_dashboard.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.metrics && data.metrics.length > 0) return data;
    }
  } catch {}

  return null;
}

/**
 * Hook to fetch live metrics from the backend with fallback to hardcoded constants.
 * Also returns the raw dashboard data (metrics + chart_data) for sections to consume.
 */
export default function useLiveMetrics() {
  const [metrics, setMetrics] = useState<LiveMetrics>(M as LiveMetrics);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const data = await loadDashboard();

        if (!active) return;

        if (data) {
          setDashboard(data);
          const m = data.metrics;

          const getValue = (id: string, def: number = 0): number => {
            const metric = m.find((x: MetricData) => x.id === id);
            if (!metric) return def;
            const val = metric.value;
            return typeof val === "number" ? val : parseFloat(String(val)) || def;
          };

          const getStr = (id: string, def: string = ""): string => {
            const metric = m.find((x: MetricData) => x.id === id);
            return metric ? String(metric.value || metric.formatted || def) : def;
          };

          const uploaded = getValue("total_uploaded", M.uploaded);
          const created = getValue("total_processed", M.created);
          const published = getValue("total_published", M.published);
          const publishRate = getValue("publish_rate", M.publishRate);
          const multiplier = getValue("amplification_ratio", M.multiplier);
          const uploadHrs = getValue("uploaded_hours", M.uploadHrs);
          const createdHrs = getValue("processed_hours", M.createdHrs);
          const activeChannels = getValue("distinct_channels", M.activeChannels);
          const activeUsers = getValue("distinct_users", M.activeUsers);
          const zeroPubMonths = getValue("zero_pub_month_count", M.zeroPubMonths);

          const peakMonth = getStr("peak_upload_month", M.peakMonth);
          const topChannel = getStr("top_performing_channel", `${M.topCh} (${M.topChRate}%)`);

          const topChMatch = topChannel.match(/^(\w+)\s*\((\d+\.?\d*)%\)$/);
          const topCh = topChMatch ? topChMatch[1] : M.topCh;
          const topChRate = topChMatch ? parseFloat(topChMatch[2]) : M.topChRate;

          // Derive peakCreated from chart_data monthly_trends
          const monthlyTrends = data.chart_data?.monthly_trends || [];
          const peakEntry = monthlyTrends.reduce((max: any, m: any) =>
            (m.created || 0) > (max?.created || 0) ? m : max, monthlyTrends[0]);
          const peakCreated = peakEntry?.created || M.peakCreated;

          // Derive topChPub from chart_data channel_performance
          const channels = data.chart_data?.channel_performance || [];
          const topChEntry = channels.find((c: any) =>
            (c.name || "").replace("Channel ", "") === topCh
          );
          const topChPub = topChEntry?.published || M.topChPub;

          setMetrics({
            uploaded,
            created,
            published,
            unpublished: created - published,
            publishRate,
            unpubRate: 100 - publishRate,
            multiplier,
            uploadHrs,
            createdHrs,
            activeChannels,
            activeUsers,
            zeroPubMonths,
            peakMonth,
            peakCreated,
            topCh,
            topChPub,
            topChRate,
          });
          setIsLive(true);
        }
      } catch (e) {
        console.warn("Failed to fetch live metrics, using defaults:", e);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return { metrics, loading, isLive, dashboard };
}
