"""
Frontend Adapter - Transforms analytics dashboard data into the JSON format
expected by the new frontend (executive, client, funnel, trends, explorer, multidim views).

This module reads from the analytics dashboard and reshapes it for the UI components.
"""
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger("analytics.frontend_adapter")

# Path to agent directory
_backend_dir = Path(__file__).parent.parent
_agent_dir = _backend_dir.parent


def get_metric_value(metrics: List[Dict], metric_id: str, default: Any = 0) -> Any:
    """Extract a metric value by ID from metrics list."""
    for m in metrics:
        if m.get("id") == metric_id:
            return m.get("value", default)
    return default


def get_metric_formatted(metrics: List[Dict], metric_id: str, default: str = "0") -> str:
    """Extract formatted metric value by ID."""
    for m in metrics:
        if m.get("id") == metric_id:
            return m.get("formatted", str(m.get("value", default)))
    return default


def build_executive_view(dashboard: Dict) -> Dict:
    """
    Build executive command centre data.
    Expected by: Executive Overview page
    """
    metrics = dashboard.get("metrics", [])
    chart_data = dashboard.get("chart_data", {})
    
    # Get totals from metrics
    total_uploaded = get_metric_value(metrics, "total_uploaded", 0)
    total_created = get_metric_value(metrics, "total_processed", 0)
    total_published = get_metric_value(metrics, "total_published", 0)
    publish_rate = get_metric_value(metrics, "publish_rate", 0)
    multiplier = get_metric_value(metrics, "amplification_ratio", 0)
    active_channels = get_metric_value(metrics, "distinct_channels", 0)
    uploaded_hours = get_metric_value(metrics, "uploaded_hours", 0)
    
    # Monthly data from chart_data
    monthly_trends = chart_data.get("monthly_trends", [])
    monthly_data = []
    for row in monthly_trends:
        monthly_data.append({
            "month": row.get("month", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedDur": 0,  # Duration data if available
            "createdDur": 0,
            "publishedDur": 0,
        })
    
    # Input types from chart_data
    input_type_data = chart_data.get("input_type_mix", [])
    input_types = []
    for row in input_type_data:
        input_types.append({
            "type": row.get("name", ""),
            "uploaded": row.get("value", 0),
            "created": row.get("value", 0),
            "published": 0,
            "uploadedH": 0,
            "createdH": 0,
        })
    
    # Channels from chart_data
    channel_perf = chart_data.get("channel_performance", [])
    channels = []
    for row in channel_perf:
        channels.append({
            "ch": row.get("name", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
            "platforms": {},
            "noPublish": row.get("published", 0) == 0,
        })
    
    # Calculate zero publish months
    zero_pub_months = sum(1 for m in monthly_data if m.get("published", 0) == 0)
    
    # Find peak month
    peak_month = get_metric_value(metrics, "peak_upload_month", "N/A")
    top_channel = get_metric_value(metrics, "top_performing_channel", "N/A")
    
    # Build strategic signals
    publish_gap = 100 - publish_rate if publish_rate else 100
    drop_off = total_created - total_published
    
    signals = []
    if publish_rate < 10:
        signals.append({
            "type": "crit",
            "tag": "⚠ CRITICAL",
            "num": f"{publish_gap:.1f}%",
            "text": "of processed content never published.",
            "stat": f"Created: {total_created:,} · Published: {total_published:,} · Gap: {drop_off:,}",
            "k": "c1",
        })
    if zero_pub_months > 0:
        signals.append({
            "type": "warn",
            "tag": "⚡ PATTERN",
            "num": str(zero_pub_months),
            "text": "months had zero published output.",
            "stat": "Check operational bottlenecks",
            "k": "c2",
        })
    if peak_month != "N/A":
        signals.append({
            "type": "ok",
            "tag": "↑ MOMENTUM",
            "num": peak_month,
            "text": "was the peak upload month.",
            "stat": "Growth confirmed",
            "k": "c3",
        })
    
    return {
        "meta": {
            "tag": "EXECUTIVE COMMAND CENTRE",
            "title": "Executive Overview",
            "sub": "Platform performance at a glance — growth, red flags, and top-line KPIs."
        },
        "monthlyData": monthly_data,
        "inputTypes": input_types,
        "channels": channels,
        "totals": {
            "totalCreated": total_created,
            "totalUploaded": total_uploaded,
            "totalPublished": total_published,
            "publishRate": round(publish_rate, 1),
            "multiplier": round(multiplier, 1),
            "activeChannels": active_channels,
        },
        "strategicSignals": signals,
        "hero": {
            "eyebrow": "AI PROCESSED — ALL TIME"
        },
        "statCards": [
            {
                "label": "UPLOADED",
                "sub": f"{uploaded_hours:.0f} hrs source footage",
                "color": "var(--ink2)",
            },
            {
                "label": "PUBLISHED", 
                "sub": f"of {total_created:,} AI outputs distributed",
                "color": "var(--amber)",
            },
            {
                "label": "PUB RATE",
                "sub": f"{publish_gap:.1f}% utilization gap",
                "color": "var(--red)" if publish_rate < 10 else "var(--green)",
            },
        ],
        "contextStrip": [
            {"label": "AI MULTIPLIER", "v": f"{multiplier:.1f}×", "sub": "inputs → AI outputs"},
            {"label": "TOP CHANNEL", "v": str(top_channel).split(" ")[0] if top_channel else "N/A", "sub": "best performer"},
            {"label": "PEAK MONTH", "v": peak_month, "sub": "highest volume"},
            {"label": "PUBLISH GAP", "v": f"{publish_gap:.1f}%", "sub": f"{drop_off:,} never distributed"},
        ],
        "statusDonut": [
            {"label": "Unpublished", "value": drop_off, "color": "#6a1818"},
            {"label": "Published", "value": total_published, "color": "#30b060"},
        ],
        "toasts": [],
    }


def _build_client_signals(total_uploaded, total_created, total_published, publish_rate, multiplier, active_channels):
    """Generate key signals for the client overview."""
    content_gap = total_created - total_published
    signals = []
    if publish_rate < 10:
        signals.append({
            "type": "crit",
            "tag": "⚠ CRITICAL — PUBLISH GAP",
            "text": f"{100 - publish_rate:.1f}% of processed content never published. {content_gap:,} items sitting idle.",
        })
    else:
        signals.append({
            "type": "ok",
            "tag": "✓ PUBLISH RATE",
            "text": f"{publish_rate:.1f}% publish rate across {active_channels} channels.",
        })
    signals.append({
        "type": "info",
        "tag": "◈ AI MULTIPLIER",
        "text": f"{multiplier:.1f}× amplification — {total_uploaded:,} uploads produced {total_created:,} AI outputs.",
    })
    return signals


def build_client_view(dashboard: Dict) -> Dict:
    """Build client profile data."""
    metrics = dashboard.get("metrics", [])
    chart_data = dashboard.get("chart_data", {})
    
    total_uploaded = get_metric_value(metrics, "total_uploaded", 0)
    total_created = get_metric_value(metrics, "total_processed", 0)
    total_published = get_metric_value(metrics, "total_published", 0)
    publish_rate = get_metric_value(metrics, "publish_rate", 0)
    multiplier = get_metric_value(metrics, "amplification_ratio", 0)
    active_channels = get_metric_value(metrics, "distinct_channels", 0)
    distinct_users = get_metric_value(metrics, "distinct_users", 0)
    
    # Channels from chart_data
    channel_perf = chart_data.get("channel_performance", [])
    channels = []
    for row in channel_perf:
        channels.append({
            "ch": row.get("name", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
            "platforms": {},
            "noPublish": row.get("published", 0) == 0,
        })
    
    return {
        "meta": {
            "tag": "CLIENT OVERVIEW",
            "badge": "EXPLICIT ACCESS ONLY",
            "title": "Client Profile",
            "sub": "Client dataset overview"
        },
        "summaryCards": [
            {"l": "Client ID", "v": "[Anon]", "c": "var(--ink)", "icon": "◎"},
            {"l": "Active Channels", "v": str(active_channels), "c": "var(--gold-lt)", "icon": "◉"},
            {"l": "Active Users", "v": str(distinct_users), "c": "var(--ink2)", "icon": "⊹"},
            {"l": "Dataset Period", "v": "12 months", "c": "var(--amber)", "icon": "⊳"},
        ],
        "pipelineSummary": [
            {"l": "Total Uploaded", "v": f"{total_uploaded:,}", "pct": 100, "color": "var(--ink3)"},
            {"l": "Total Processed", "v": f"{total_created:,}", "pct": 100, "color": "var(--gold)"},
            {"l": "Total Published", "v": f"{total_published:,}", "pct": publish_rate, "color": "var(--amber)"},
            {"l": "Publish Rate", "v": f"{publish_rate:.1f}%", "pct": publish_rate, "color": "var(--red)" if publish_rate < 10 else "var(--green)"},
            {"l": "AI Multiplier", "v": f"{multiplier:.1f}×", "pct": min(multiplier * 25, 100), "color": "var(--gold-lt)"},
        ],
        "channels": channels,
        "keySignals": _build_client_signals(total_uploaded, total_created, total_published, publish_rate, multiplier, active_channels),
    }


def build_funnel_view(dashboard: Dict) -> Dict:
    """Build content mix and publishing funnel data."""
    metrics = dashboard.get("metrics", [])
    chart_data = dashboard.get("chart_data", {})
    
    total_uploaded = get_metric_value(metrics, "total_uploaded", 0)
    total_created = get_metric_value(metrics, "total_processed", 0)
    total_published = get_metric_value(metrics, "total_published", 0)
    publish_rate = get_metric_value(metrics, "publish_rate", 0)
    multiplier = get_metric_value(metrics, "amplification_ratio", 0)
    
    # Input types
    input_type_data = chart_data.get("input_type_mix", [])
    input_types = []
    for row in input_type_data:
        input_types.append({
            "type": row.get("name", ""),
            "uploaded": row.get("value", 0),
            "created": row.get("value", 0),
            "published": 0,
            "uploadedH": 0,
            "createdH": 0,
        })
    
    # Languages
    language_data = chart_data.get("language_breakdown", [])
    languages = []
    for row in language_data:
        languages.append({
            "lang": row.get("lang", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
        })
    
    # Channels
    channel_perf = chart_data.get("channel_performance", [])
    channels = []
    for row in channel_perf:
        channels.append({
            "ch": row.get("name", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
            "platforms": {},
            "noPublish": row.get("published", 0) == 0,
        })
    
    # Sankey data - simplified
    unpublished = total_created - total_published
    sankey_funnel = {
        "nodes": ["Uploads", "AI Created", "Published", "Unpublished"],
        "links": [
            {"source": "Uploads", "target": "AI Created", "value": total_uploaded},
            {"source": "AI Created", "target": "Published", "value": total_published},
            {"source": "AI Created", "target": "Unpublished", "value": unpublished},
        ]
    }
    
    return {
        "meta": {
            "tag": "CONTENT MIX & PUBLISHING FUNNEL",
            "title": "Content Mix & Publishing Funnel",
            "sub": "What content types are produced, where publish drop-off occurs, and channel conversion rates."
        },
        "subTabs": [
            ["sankey", "Sankey Flow"],
            ["pipeline", "Pipeline"],
            ["channels", "By Channel"],
            ["types", "By Type"],
        ],
        "inputTypes": input_types,
        "languages": languages,
        "channels": channels,
        "totals": {
            "totalUploaded": total_uploaded,
            "totalCreated": total_created,
            "totalPublished": total_published,
            "publishRate": round(publish_rate, 1),
            "multiplier": round(multiplier, 1),
        },
        "sankey": {
            "funnel": sankey_funnel,
        },
        "contentFlowLegend": [
            {"c": "var(--ink3)", "l": f"Uploaded: {total_uploaded:,}"},
            {"c": "var(--gold)", "l": f"AI Created: {total_created:,} ({multiplier:.1f}×)"},
            {"c": "var(--green)", "l": f"Published: {total_published:,} ({publish_rate:.1f}%)"},
            {"c": "#6a1818", "l": f"Unpublished: {unpublished:,} ({100-publish_rate:.1f}%)"},
        ],
        "dataQualityAlerts": [
            {"c": "warn", "t": f"Only {publish_rate:.1f}% of AI-created content reaches publication."},
            {"c": "crit" if unpublished > 1000 else "info", "t": f"{unpublished:,} items created but never published."},
        ],
        "typeTreemapColors": ["#d4952a", "#8B5CF6", "#3EC98A", "#45aaf2", "#ff6b7a", "#f0b84a"],
        "sankeyTypeOptions": [["funnel", "Upload→Publish"], ["channel", "Channel→Platform"], ["content", "Content→Language"]],
    }


def build_trends_view(dashboard: Dict) -> Dict:
    """Build temporal analysis / trends data."""
    chart_data = dashboard.get("chart_data", {})
    
    # Monthly data from chart_data
    monthly_trends = chart_data.get("monthly_trends", [])
    monthly_data = []
    for row in monthly_trends:
        monthly_data.append({
            "month": row.get("month", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedDur": 0,
            "createdDur": 0,
            "publishedDur": 0,
        })
    
    return {
        "meta": {
            "tag": "TEMPORAL ANALYSIS",
            "title": "Usage & Trend Analysis",
            "sub": "How volumes trend over time — strongest periods, count vs duration, H1 vs H2."
        },
        "monthlyData": monthly_data,
        "metricOptions": [["count", "Count"], ["duration", "Duration"]],
        "timeOptions": [["all", "All months"], ["h1", "H1"], ["h2", "H2"]],
        "compareToggle": "H1 vs H2 Overlay",
        "heatLegend": {
            "colors": ["#1a1614", "#4a2a08", "#7a4a10", "#b87514", "#d4952a", "#f0b84a"],
            "label": "Low → Peak creation"
        },
        "durationLegend": [
            ["Uploaded Duration", "var(--ink3)"],
            ["Created Duration", "var(--gold)"],
            ["Published Duration", "var(--green)"],
        ],
    }


def build_explorer_view(dashboard: Dict) -> Dict:
    """Build data explorer and quality diagnostics."""
    metrics = dashboard.get("metrics", [])
    chart_data = dashboard.get("chart_data", {})
    
    # Users from chart_data
    user_perf = chart_data.get("user_performance", [])
    users = []
    for row in user_perf:
        users.append({
            "user": row.get("user", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
        })
    
    # Languages
    language_data = chart_data.get("language_breakdown", [])
    languages = []
    for row in language_data:
        languages.append({
            "lang": row.get("lang", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
        })
    
    # Input types
    input_type_data = chart_data.get("input_type_mix", [])
    input_types = []
    for row in input_type_data:
        input_types.append({
            "type": row.get("name", ""),
            "uploaded": row.get("value", 0),
            "created": row.get("value", 0),
            "published": 0,
            "uploadedH": 0,
            "createdH": 0,
        })
    
    # Channels
    channel_perf = chart_data.get("channel_performance", [])
    channel_metrics = []
    for row in channel_perf:
        channel_metrics.append({
            "label": row.get("name", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
        })
    
    # Platform heatmap data
    platform_dist = chart_data.get("platform_distribution", [])
    platform_names = [p.get("name", "") for p in platform_dist if p.get("value", 0) > 0]
    platform_heatmap = []
    for ch in channel_perf:
        ch_name = ch.get("name", "")
        ch_published = ch.get("published", 0)
        total_plat_val = sum(p.get("value", 0) for p in platform_dist) or 1
        values = [round(ch_published * p.get("value", 0) / total_plat_val) for p in platform_dist if p.get("value", 0) > 0]
        platform_heatmap.append({"channel": ch_name, "values": values})

    # Data quality metrics
    unknown_team_rate = get_metric_value(metrics, "unknown_team_rate", 0)
    null_platform_rate = get_metric_value(metrics, "null_platform_rate", 0)
    data_quality_score = get_metric_value(metrics, "data_quality_score", 0)

    return {
        "meta": {
            "tag": "VIDEO EXPLORER & DATA QUALITY",
            "title": "Data Explorer & Quality Diagnostics",
            "sub": "User rankings, channel drilldown, data completeness, KPI framework tree."
        },
        "subTabs": [
            ["users", "User Rankings"],
            ["channels", "Channel Drilldown"],
            ["quality", "Data Quality"],
            ["advanced_kpi", "KPI Framework"],
        ],
        "userSortOptions": [["created", "Created"], ["published", "Published"], ["uploaded", "Uploaded"]],
        "users": users,
        "languages": languages,
        "inputTypes": input_types,
        "channelMetrics": channel_metrics,
        "dataQualityRows": [
            {
                "l": "Team Name Unknown", "v": f"{unknown_team_rate:.1f}%",
                "c": "var(--red-lt)" if unknown_team_rate > 50 else "var(--green-lt)",
                "severity": "critical" if unknown_team_rate > 50 else "warning",
                "detail": f"Team name field is missing or unknown in {unknown_team_rate:.1f}% of records, blocking team-level attribution.",
                "pct": int(unknown_team_rate),
            },
            {
                "l": "Platform NULL (published)", "v": f"{null_platform_rate:.1f}%",
                "c": "var(--red-lt)" if null_platform_rate > 50 else "var(--green-lt)",
                "severity": "critical" if null_platform_rate > 50 else "warning",
                "detail": f"Platform field is NULL on {null_platform_rate:.1f}% of published rows, undermining distribution analysis.",
                "pct": int(null_platform_rate),
            },
            {
                "l": "Data Quality Score", "v": f"{data_quality_score:.1f}%",
                "c": "var(--green-lt)" if data_quality_score > 70 else "var(--amber-lt)",
                "severity": "warning" if data_quality_score < 70 else "info",
                "detail": f"Overall data quality score is {data_quality_score:.1f}% based on field completeness and integrity checks.",
                "pct": int(data_quality_score),
            },
        ],
        "completenessRings": [
            {"label": "Overall", "pct": int(data_quality_score), "color": "var(--amber)", "size": 68},
            {"label": "Core Fields", "pct": 98, "color": "var(--green)", "size": 54},
        ],
        "platformNames": platform_names,
        "platformHeatmap": platform_heatmap,
    }


def build_multidim_view(dashboard: Dict) -> Dict:
    """Build multi-dimensional analysis (channel/user intelligence)."""
    chart_data = dashboard.get("chart_data", {})
    
    # Input types
    input_type_data = chart_data.get("input_type_mix", [])
    input_types = []
    for row in input_type_data:
        input_types.append({
            "type": row.get("name", ""),
            "uploaded": row.get("value", 0),
            "created": row.get("value", 0),
            "published": 0,
            "uploadedH": 0,
            "createdH": 0,
        })
    
    # Languages
    language_data = chart_data.get("language_breakdown", [])
    languages = []
    for row in language_data:
        languages.append({
            "lang": row.get("lang", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
        })
    
    # Users
    user_perf = chart_data.get("user_performance", [])
    users = []
    for row in user_perf:
        users.append({
            "user": row.get("user", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedH": 0,
        })
    
    # Channels
    channel_perf = chart_data.get("channel_performance", [])
    channel_metrics = []
    for row in channel_perf:
        channel_metrics.append({
            "label": row.get("name", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
        })
    
    # Build ternary datasets
    ternary_channels = [{"label": c["label"], "uploaded": c["uploaded"], "created": c["created"], "published": c["published"]} for c in channel_metrics]
    ternary_users = [{"label": u["user"], "uploaded": u["uploaded"], "created": u["created"], "published": u["published"]} for u in users]
    ternary_inputtypes = [{"label": t["type"], "uploaded": t["uploaded"], "created": t["created"], "published": t["published"]} for t in input_types]
    
    return {
        "meta": {
            "tag": "CHANNEL · USER · PLATFORM INTELLIGENCE",
            "title": "Channel & User Intelligence",
            "sub": "Which channels and users drive volume, and how dimensions compare."
        },
        "inputTypes": input_types,
        "languages": languages,
        "users": users,
        "channelMetrics": channel_metrics,
        "kpiOptions": [
            {"k": "uploaded", "l": "Uploaded"},
            {"k": "created", "l": "Created"},
            {"k": "published", "l": "Published"},
            {"k": "pub_rate", "l": "Pub Rate"},
        ],
        "viewOptions": [["bar", "Bar Chart"], ["heatmap", "Heatmap"], ["treemap", "Treemap"], ["ternary", "Ternary"]],
        "ternaryDatasets": {
            "channels": ternary_channels,
            "users": ternary_users,
            "inputtypes": ternary_inputtypes,
        },
        "ternaryAxisOptions": {
            "dataset": [["channels", "Channels"], ["users", "Users"], ["inputtypes", "Input types"]],
            "common": ["uploaded", "created", "published", "pub_rate", "multiplier"],
        },
    }


def transform_dashboard_for_frontend(dashboard: Dict) -> Dict:
    """
    Main entry point: transform analytics dashboard into frontend-expected format.
    Returns a dict with all views: executive, client, funnel, trends, explorer, multidim.
    """
    try:
        result = {
            "generated_at": datetime.now().isoformat(),
            "executive": build_executive_view(dashboard),
            "client": build_client_view(dashboard),
            "funnel": build_funnel_view(dashboard),
            "trends": build_trends_view(dashboard),
            "explorer": build_explorer_view(dashboard),
            "multidim": build_multidim_view(dashboard),
            # Pass through raw data for components that need it
            "raw_metrics": dashboard.get("metrics", []),
            "raw_chart_data": dashboard.get("chart_data", {}),
        }
        return result
    except Exception as e:
        logger.exception(f"Frontend adapter error: {e}")
        return {
            "error": str(e),
            "executive": {},
            "client": {},
            "funnel": {},
            "trends": {},
            "explorer": {},
            "multidim": {},
        }


def get_view(dashboard: Dict, view_name: str) -> Dict:
    """Get a specific view from dashboard."""
    builders = {
        "executive": build_executive_view,
        "client": build_client_view,
        "funnel": build_funnel_view,
        "trends": build_trends_view,
        "explorer": build_explorer_view,
        "multidim": build_multidim_view,
    }
    builder = builders.get(view_name)
    if builder:
        return builder(dashboard)
    return {}
