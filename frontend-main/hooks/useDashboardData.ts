"use client";

import { useMemo } from "react";
import { type DashboardData } from "@/lib/api";

// Default meta per section so we never crash on .meta.tag
const SECTION_META: Record<string, any> = {
  executive: { tag: "EXECUTIVE COMMAND CENTRE", title: "Executive Overview", sub: "Platform performance at a glance" },
  trends:    { tag: "PERFORMANCE TRENDS", title: "Performance Trends", sub: "12-month upload vs publish trajectory" },
  funnel:    { tag: "CONTENT FUNNEL", title: "Content Funnel", sub: "Upload → Create → Publish conversion" },
  multidim:  { tag: "MULTI-DIMENSIONAL ANALYSIS", title: "Multi-Dimensional Analysis", sub: "Channel × content type breakdown" },
  explorer:  { tag: "DEEP EXPLORER", title: "Explorer", sub: "Filterable channel × content data table" },
};

/**
 * Transforms backend analytics_dashboard.json into the shape each section expects.
 * Backend is PRIMARY. Static json/ is fallback when backend is unavailable.
 */
export function useLiveSectionData(
  sectionKey: string,
  dashboard: DashboardData | null | undefined,
  staticData: any
) {
  return useMemo(() => {
    // No backend data — fall back to static json (or null, sections guard with if(!data) return null)
    if (!dashboard || !dashboard.metrics?.length || !dashboard.chart_data) {
      return staticData || null;
    }

    const cd = dashboard.chart_data;
    const m = dashboard.metrics;
    // Static provides UI config (legends, colors, options). May be null if still loading.
    const s = staticData || {};
    const meta = s.meta || SECTION_META[sectionKey] || { tag: "", title: "", sub: "" };

    const getVal = (id: string, def: number = 0): number => {
      const met = m.find((x: any) => x.id === id);
      if (!met) return def;
      const v = met.value;
      return typeof v === "number" ? v : parseFloat(String(v)) || def;
    };

    // ── Shared transforms ──
    // Parse "HH:MM:SS" duration string to hours (float)
    const durToHours = (d: any): number => {
      if (typeof d === "number") return d;
      if (typeof d !== "string" || !d.includes(":")) return 0;
      const parts = d.split(":").map(Number);
      return (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
    };

    const monthlyData = (cd.monthly_trends || []).map((t: any) => ({
      month: t.month,
      uploaded: t.uploaded || 0,
      created: t.created || 0,
      published: t.published || 0,
      uploadedDur: durToHours(t.uploadedDuration ?? t.uploadedDur ?? t.uploaded_dur ?? 0),
      createdDur: durToHours(t.createdDuration ?? t.createdDur ?? t.created_dur ?? 0),
      publishedDur: durToHours(t.publishedDuration ?? t.publishedDur ?? t.published_dur ?? 0),
    }));

    const channels = (cd.channel_performance || []).map((c: any) => ({
      ch: (c.name || "").replace("Channel ", ""),
      label: c.name || "",
      uploaded: c.uploaded || 0,
      created: c.created || 0,
      published: c.published || 0,
      rate: c.rate || 0,
      amp: c.amp || 0,
      uploadedH: 0,
      platforms: {},
      noPublish: (c.published || 0) === 0,
    }));

    // Use input_type_performance (full breakdown) if available, fallback to input_type_mix (pie only)
    const rawInputTypes = cd.input_type_performance || [];
    const inputTypes = rawInputTypes.length > 0
      ? rawInputTypes.map((t: any) => ({
          type: t.type,
          uploaded: t.uploaded || 0,
          created: t.created || 0,
          published: t.published || 0,
          uploadedH: 0,
          createdH: 0,
          publishRate: t.publishRate || 0,
          amp: t.amp || 0,
        }))
      : (cd.input_type_mix || []).map((t: any) => ({
          type: t.name,
          uploaded: t.value || 0,
          created: 0,
          published: 0,
          uploadedH: 0,
          createdH: 0,
          color: t.color,
        }));

    const languages = (cd.language_breakdown || []).map((l: any) => ({
      lang: l.lang,
      uploaded: l.uploaded || 0,
      created: l.created || 0,
      published: l.published || 0,
      uploadedH: 0,
      publishRate: l.publishRate || 0,
    }));

    const users = (cd.user_performance || []).map((u: any) => ({
      user: u.user,
      uploaded: u.uploaded || 0,
      created: u.created || 0,
      published: u.published || 0,
      uploadedH: 0,
      rate: u.rate || 0,
    }));

    const channelMetrics = channels.map((c: any) => ({
      label: c.ch,
      uploaded: c.uploaded,
      created: c.created,
      published: c.published,
    }));

    const totalUploaded = getVal("total_uploaded");
    const totalCreated = getVal("total_processed");
    const totalPublished = getVal("total_published");
    const publishRate = getVal("publish_rate");
    const multiplier = getVal("amplification_ratio");
    const totals = { totalUploaded, totalCreated, totalPublished, publishRate, multiplier };

    // ── Section assembly ──

    if (sectionKey === "executive") {
      const outputMix = (cd.output_type_mix || []).map((t: any) => ({
        label: t.name, value: t.value || 0, color: t.color,
      }));

      // Build strategic signals from backend metrics when no static data
      const contentGap = totalCreated - totalPublished;
      const defaultSignals = [
        {
          type: publishRate < 5 ? "crit" : "ok", tag: publishRate < 5 ? "⚠ CRITICAL" : "✓ OK",
          num: `${(100 - publishRate).toFixed(1)}%`, text: "of processed content never published.",
          stat: `Created: ${totalCreated.toLocaleString()} · Published: ${totalPublished.toLocaleString()} · Gap: ${contentGap.toLocaleString()}`,
          k: "c1", expand: `${contentGap.toLocaleString()} videos created and never distributed.`,
        },
        {
          type: "info", tag: "◈ BENCHMARK",
          num: `${multiplier.toFixed(1)}×`, text: "amplification ratio (uploads → AI outputs).",
          stat: `${totalUploaded.toLocaleString()} uploaded → ${totalCreated.toLocaleString()} created`,
          k: "c2",
        },
      ];

      // Build context strip from backend metrics when static hasn't loaded
      const topChannel = channels.length ? channels.reduce((a: any, b: any) => (b.published > a.published ? b : a), channels[0]) : null;
      const peakMonth = monthlyData.length ? monthlyData.reduce((a: any, b: any) => ((b.created || 0) > (a.created || 0) ? b : a), monthlyData[0]) : null;
      const defaultContextStrip = [
        { label: "UPLOAD PERIOD", v: monthlyData.length ? `${monthlyData[0].month} – ${monthlyData[monthlyData.length - 1].month}` : "—", sub: `${monthlyData.length} months active` },
        { label: "AI MULTIPLIER", v: `${multiplier.toFixed(1)}×`, sub: "inputs → AI outputs" },
        { label: "TOP CHANNEL", v: topChannel ? `Ch-${topChannel.ch}` : "—", sub: topChannel ? `${topChannel.published} pub · ${topChannel.rate.toFixed(1)}% rate` : "" },
        { label: "PEAK MONTH", v: peakMonth ? peakMonth.month : "—", sub: peakMonth ? `${peakMonth.created.toLocaleString()} outputs` : "" },
        { label: "PUBLISH GAP", v: `${(100 - publishRate).toFixed(1)}%`, sub: `${(totalCreated - totalPublished).toLocaleString()} never distributed` },
      ];

      return {
        ...s,
        meta,
        monthlyData,
        channels,
        inputTypes,
        totals: { ...totals, activeChannels: getVal("distinct_channels", 18) },
        statusDonut: outputMix.length ? outputMix : (s.statusDonut || []),
        contextStrip: s.contextStrip || defaultContextStrip,
        strategicSignals: s.strategicSignals || defaultSignals,
        toasts: s.toasts || [],
        monthlyChart: s.monthlyChart || {
          badge: peakMonth ? `${peakMonth.month} peak` : "",
          legend: [["Uploaded", "var(--gold)"], ["Published", "var(--suc)"], ["Created", "var(--pri)"]],
        },
        _live: true,
      };
    }

    if (sectionKey === "trends") {
      return {
        ...s,
        meta,
        monthlyData,
        // Provide defaults for UI config the section expects
        metricOptions: s.metricOptions || [["count", "Count"], ["duration", "Duration"]],
        timeOptions: s.timeOptions || [["all", "All 12 months"], ["h1", "H1 Mar–Aug"], ["h2", "H2 Sep–Feb"]],
        compareToggle: s.compareToggle || "H1 vs H2 Overlay",
        heatLegend: s.heatLegend || { colors: [], label: "" },
        durationLegend: s.durationLegend || [],
        _live: true,
      };
    }

    if (sectionKey === "funnel") {
      const platforms = (cd.platform_distribution || []).filter((p: any) => p.value > 0);
      const topPlatforms = platforms.slice(0, 5);
      const topLangs = languages.filter((l: any) => l.published > 0).slice(0, 3);
      const publishingChannels = channels.filter((c: any) => c.published > 0).slice(0, 8);

      // ── Funnel sankey: Uploads → AI Created → Published/Unpublished → Languages → Platforms ──
      const sankeyFunnel = (() => {
        const nodes: string[] = ["Uploads", "AI Created", "Published", "Unpublished"];
        const links: any[] = [
          { source: "Uploads", target: "AI Created", value: totalUploaded },
          { source: "AI Created", target: "Published", value: totalPublished },
          { source: "AI Created", target: "Unpublished", value: Math.max(totalCreated - totalPublished, 0) },
        ];
        // Published → Languages
        for (const l of topLangs) {
          nodes.push(l.lang);
          links.push({ source: "Published", target: l.lang, value: l.published });
        }
        if (topLangs.length > 0 && totalPublished > topLangs.reduce((s: number, l: any) => s + l.published, 0)) {
          nodes.push("Other");
          links.push({ source: "Published", target: "Other", value: totalPublished - topLangs.reduce((s: number, l: any) => s + l.published, 0) });
        }
        // Languages → Platforms (distribute proportionally)
        const langNodes = topLangs.map((l: any) => l.lang);
        const totalPlatVal = topPlatforms.reduce((s: number, p: any) => s + p.value, 0);
        for (const lang of langNodes) {
          const langPub = topLangs.find((l: any) => l.lang === lang)?.published || 0;
          for (const p of topPlatforms) {
            const val = Math.round((langPub * p.value) / (totalPlatVal || 1));
            if (val > 0) {
              if (!nodes.includes(p.name)) nodes.push(p.name);
              links.push({ source: lang, target: p.name, value: val });
            }
          }
        }
        return { nodes, links };
      })();

      // ── Channel sankey: Channels → Platforms ──
      const sankeyChannel = (() => {
        const nodes: string[] = [...publishingChannels.map(c => `Ch-${c.ch}`)];
        const links: any[] = [];
        const platNames = topPlatforms.map((p: any) => p.name);
        const totalPlatVal = topPlatforms.reduce((s: number, p: any) => s + p.value, 0);
        for (const c of publishingChannels) {
          for (const p of topPlatforms) {
            const val = Math.round((c.published * p.value) / (totalPlatVal || 1));
            if (val > 0) {
              if (!nodes.includes(p.name)) nodes.push(p.name);
              links.push({ source: `Ch-${c.ch}`, target: p.name, value: val });
            }
          }
          // If channel has no platform links, add a single link
          if (!links.some(lk => lk.source === `Ch-${c.ch}`)) {
            if (!nodes.includes("Other")) nodes.push("Other");
            links.push({ source: `Ch-${c.ch}`, target: "Other", value: c.published || 1 });
          }
        }
        return { nodes, links };
      })();

      // ── Content sankey: Input Types → Languages → Published/Unpublished ──
      const sankeyContent = (() => {
        const topTypes = inputTypes.filter((t: any) => t.published > 0).slice(0, 7);
        const nodes: string[] = [...topTypes.map((t: any) => t.type)];
        const links: any[] = [];
        const pubNode = `Published (${totalPublished})`;
        const unpubNode = "Unpublished";
        // Types → Languages
        for (const t of topTypes) {
          for (const l of topLangs) {
            const val = Math.round((t.published * l.published) / (totalPublished || 1));
            if (val > 0) {
              if (!nodes.includes(l.lang)) nodes.push(l.lang);
              links.push({ source: t.type, target: l.lang, value: val });
            }
          }
          // If no language links, direct to published
          if (!links.some(lk => lk.source === t.type)) {
            if (!nodes.includes(pubNode)) nodes.push(pubNode);
            links.push({ source: t.type, target: pubNode, value: t.published || 1 });
          }
        }
        return { nodes, links };
      })();
      return {
        ...s,
        meta,
        inputTypes,
        languages,
        channels,
        totals,
        subTabs: s.subTabs || [["sankey", "Sankey Flow"], ["pipeline", "Pipeline"], ["channels", "By Channel"], ["types", "By Type"]],
        sankeyTypeOptions: s.sankeyTypeOptions || [["funnel", "Upload→Publish"], ["channel", "Channel→Platform"], ["content", "Content→Language"]],
        contentFlowLegend: s.contentFlowLegend || [],
        dataQualityAlerts: s.dataQualityAlerts || [],
        typeTreemapColors: s.typeTreemapColors || [],
        sankey: {
          funnel: sankeyFunnel,
          channel: sankeyChannel,
          content: sankeyContent,
        },
        _live: true,
      };
    }

    if (sectionKey === "multidim") {
      const ternaryChannels = channels.map(c => ({
        label: `Ch-${c.ch}`, top: c.rate, left: c.uploaded, right: c.created,
      }));
      const ternaryUsers = users.slice(0, 20).map(u => ({
        label: u.user, top: u.rate, left: u.uploaded, right: u.created,
      }));
      const ternaryInputTypes = inputTypes.map(t => ({
        label: t.type, top: 0, left: t.uploaded, right: t.created,
      }));
      const chUserBreak = cd.channel_user_breakdown || [];
      const heatData = chUserBreak.slice(0, 50).map((r: any) => ({
        input: `Ch-${r.channel}`, lang: r.user, val: r.created || 0,
      }));
      return {
        ...s,
        meta,
        inputTypes,
        languages,
        users,
        channelMetrics,
        kpiOptions: s.kpiOptions || [{ k: "uploaded", l: "Uploaded" }, { k: "created", l: "Created" }, { k: "published", l: "Published" }],
        viewOptions: s.viewOptions || [["bar", "Bar Chart"], ["heatmap", "Heatmap"], ["treemap", "Treemap"], ["ternary", "Ternary"]],
        heatData: heatData.length ? heatData : (s.heatData || []),
        treemapColors: s.treemapColors || [],
        ternaryDatasets: { channels: ternaryChannels, users: ternaryUsers, inputtypes: ternaryInputTypes },
        ternaryAxisOptions: s.ternaryAxisOptions || {
          dataset: [["channels", `Channels (${channels.length})`], ["users", `Users (${users.length})`], ["inputtypes", "Input types"]],
          common: ["uploaded", "created", "published", "pub_rate", "multiplier"],
          right: ["created", "uploaded", "published", "pub_rate", "multiplier"],
        },
        _live: true,
      };
    }

    if (sectionKey === "explorer") {
      const platformKeyLabels: [string, string][] = [
        ["facebook", "Facebook"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"],
        ["youtube", "YouTube"], ["x", "X"], ["shorts", "Shorts"], ["reels", "Reels"], ["threads", "Threads"],
      ];

      // Build heatmap from channel_platform_heatmap chart data
      const heatmapRaw = cd.channel_platform_heatmap || [];
      let platformNames: string[] = [];
      let platformHeatmap: any[] = [];
      if (heatmapRaw.length > 0) {
        // Filter to platforms that have at least one non-zero value
        const activePlatforms = platformKeyLabels.filter(([key]) =>
          heatmapRaw.some((r: any) => (r[key] || 0) > 0)
        );
        platformNames = activePlatforms.map(([, label]) => label);
        platformHeatmap = heatmapRaw.map((r: any) => ({
          channel: r.channel || "",
          values: activePlatforms.map(([key]) => r[key] || 0),
        }));
      } else {
        // Fallback to static or distribution-based names
        platformNames = (cd.platform_distribution || []).map((p: any) => p.name);
      }

      const languageDonut = languages.slice(0, 5).map((l, i) => ({
        label: l.lang, value: l.uploaded,
        color: ["var(--pri)", "var(--amber)", "var(--suc)", "var(--red)", "var(--ink3)"][i % 5],
      }));

      const unknownTeam = getVal("unknown_team_rate", 99);
      const nullPlatform = getVal("null_platform_rate", 136);
      const qualityScore = getVal("data_quality_score", 30);
      const completenessRings = [
        { label: "Team Attribution", pct: Math.max(0, 100 - unknownTeam), color: "var(--red)", size: 48 },
        { label: "Platform Data", pct: Math.max(0, 100 - nullPlatform), color: "var(--amber)", size: 48 },
        { label: "Data Quality", pct: qualityScore, color: "var(--suc)", size: 48 },
      ];

      // Build data quality rows from backend metrics
      const publishRate = getVal("publish_rate", 0);
      const zeroPubChannels = getVal("zero_pub_channel_count", 0);
      const zeroPubUsers = getVal("zero_pub_user_count", 0);
      const publishDropoff = getVal("publish_dropoff", 0);
      const totalChannels = getVal("distinct_channels", 0);
      const totalUsers = getVal("distinct_users", 0);
      const dataQualityRows = [
        {
          l: "Team Attribution",
          v: `${(100 - unknownTeam).toFixed(1)}%`,
          pct: Math.max(0, 100 - unknownTeam),
          c: unknownTeam > 50 ? "var(--red-lt)" : "var(--green-lt)",
          severity: unknownTeam > 50 ? "critical" : "warning",
          detail: `${unknownTeam.toFixed(1)}% of videos have unknown team attribution`,
        },
        {
          l: "Platform Coverage",
          v: `${Math.max(0, 100 - nullPlatform).toFixed(1)}%`,
          pct: Math.max(0, 100 - nullPlatform),
          c: nullPlatform > 50 ? "var(--red-lt)" : "var(--green-lt)",
          severity: nullPlatform > 50 ? "critical" : "warning",
          detail: `${nullPlatform.toFixed(1)}% of published videos missing platform info`,
        },
        {
          l: "Overall Data Quality",
          v: `${qualityScore.toFixed(1)}%`,
          pct: qualityScore,
          c: qualityScore < 50 ? "var(--red-lt)" : qualityScore < 75 ? "var(--amber-lt)" : "var(--green-lt)",
          severity: qualityScore < 50 ? "critical" : "warning",
          detail: `Weighted completeness score across key fields`,
        },
        {
          l: "Publish Rate",
          v: `${publishRate.toFixed(2)}%`,
          pct: Math.min(publishRate * 10, 100),
          c: publishRate < 5 ? "var(--amber-lt)" : "var(--green-lt)",
          severity: publishRate < 5 ? "warning" : undefined,
          detail: `${publishDropoff.toLocaleString()} created clips never published`,
        },
        {
          l: "Zero-Publish Channels",
          v: `${zeroPubChannels} / ${totalChannels}`,
          pct: totalChannels > 0 ? ((totalChannels - zeroPubChannels) / totalChannels) * 100 : 100,
          c: zeroPubChannels > 0 ? "var(--amber-lt)" : "var(--green-lt)",
          severity: zeroPubChannels > 0 ? "warning" : undefined,
          detail: `${zeroPubChannels} channel(s) with zero published clips`,
        },
        {
          l: "Zero-Publish Users",
          v: `${zeroPubUsers} / ${totalUsers}`,
          pct: totalUsers > 0 ? ((totalUsers - zeroPubUsers) / totalUsers) * 100 : 100,
          c: zeroPubUsers > 0 ? "var(--amber-lt)" : "var(--green-lt)",
          severity: zeroPubUsers > 0 ? "warning" : undefined,
          detail: `${zeroPubUsers} user(s) with zero published clips`,
        },
      ];

      return {
        ...s,
        meta,
        users,
        languages,
        inputTypes,
        channelMetrics,
        subTabs: s.subTabs || [["users", "User Rankings"], ["channels", "Channel Drilldown"], ["quality", "Data Quality"], ["kpi_tree", "KPI Framework"], ["d3tree", "Hierarchy Tree"], ["advanced_kpi", "Advanced KPI"]],
        userSortOptions: s.userSortOptions || [["created", "Created"], ["published", "Published"], ["uploaded", "Uploaded"]],
        platformNames: platformNames.length ? platformNames : (s.platformNames || []),
        platformHeatmap: platformHeatmap.length ? platformHeatmap : (s.platformHeatmap || []),
        dataQualityRows,
        completenessRings,
        languageDonut,
        hierarchyOptions: s.hierarchyOptions || {
          root: [["channel", "Channel"], ["inputtype", "Input type"], ["language", "Language"]],
          child: [["user", "User"], ["channel", "Channel"], ["inputtype", "Input type"]],
          metric: [["cr", "Created"], ["up", "Uploaded"], ["pb", "Published"]],
        },
        kpiTree: (() => {
          const catLabels: Record<string, string> = {
            volume: "Volume & Scale", conversion: "Conversion & Publish",
            efficiency: "Efficiency", duration: "Duration",
            growth: "Growth & Trends", content_mix: "Content Mix",
            platform: "Platform", data_quality: "Data Quality",
          };
          const grouped: Record<string, any[]> = {};
          for (const met of m) {
            const cat = met.category || "other";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(met);
          }
          return {
            name: "Frammer KPI Framework", type: "root",
            children: Object.entries(grouped).map(([cat, items]) => ({
              name: catLabels[cat] || cat, type: "category",
              children: items.map((met: any) => ({
                name: met.name, type: "leaf",
                value: met.formatted || String(met.value),
                formula: met.function?.replace("compute_", "").replace(/_/g, " ") || "",
                avail: (met.dataset_sources || []).length ? "direct" : "derived",
                critical: cat === "data_quality" || (cat === "conversion" && met.value < 2),
              })),
            })),
          };
        })(),
        _live: true,
      };
    }

    return staticData || null;
  }, [sectionKey, dashboard, staticData]);
}
