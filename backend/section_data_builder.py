"""
Section Data Builder — transforms analytics dashboard into frontend section JSON.
Each build_* function returns a dict matching the static JSON shape for that section.
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("frammer.section_data")


def build_section(section: str, dashboard: dict) -> dict:
    """Route to the correct builder."""
    builders = {
        "executive": build_executive,
        "trends": build_trends,
        "multidim": build_multidim,
        "funnel": build_funnel,
        "explorer": build_explorer,
        "client": build_client,
        "app-shell": build_app_shell,
    }
    builder = builders.get(section)
    if not builder:
        return {"error": f"Unknown section: {section}"}
    try:
        return builder(dashboard)
    except Exception as e:
        logger.exception(f"Error building section {section}")
        return {"error": str(e)}


def _get_metric(dashboard: dict, metric_id: str, default=0):
    """Get a metric value by id from dashboard."""
    for m in dashboard.get("metrics", []):
        if m.get("id") == metric_id:
            return m.get("value", default)
    return default


def _get_metric_formatted(dashboard: dict, metric_id: str, default="0"):
    """Get formatted metric value by id."""
    for m in dashboard.get("metrics", []):
        if m.get("id") == metric_id:
            return m.get("formatted", default)
    return default


def _get_chart(dashboard: dict, chart_id: str) -> list:
    """Get chart data by id."""
    cd = dashboard.get("chart_data", {})
    return cd.get(chart_id, [])


def build_executive(dashboard: dict) -> dict:
    """Build executive section JSON from dashboard data."""
    monthly = _get_chart(dashboard, "monthly_trends")
    input_types = _get_chart(dashboard, "input_type_mix")
    channels = _get_chart(dashboard, "channel_performance")
    platform_dist = _get_chart(dashboard, "platform_distribution")

    total_created = _get_metric(dashboard, "total_processed", 0)
    total_uploaded = _get_metric(dashboard, "total_uploaded", 0)
    total_published = _get_metric(dashboard, "total_published", 0)
    publish_rate = _get_metric(dashboard, "publish_rate", 0)
    multiplier = _get_metric(dashboard, "amplification_ratio", 0)
    active_ch = _get_metric(dashboard, "active_channel_count", _get_metric(dashboard, "distinct_channels", 0))

    # Transform monthly data
    monthly_data = []
    for row in monthly:
        monthly_data.append({
            "month": row.get("month", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedDur": 0,
            "createdDur": 0,
            "publishedDur": 0,
        })

    # Transform input types
    input_type_data = []
    for row in input_types:
        input_type_data.append({
            "type": row.get("name", ""),
            "uploaded": row.get("value", 0),
            "created": 0,
            "published": 0,
            "uploadedH": 0,
            "createdH": 0,
        })

    # Build platform lookup by channel
    platform_by_channel = {}
    if isinstance(platform_dist, list):
        for row in platform_dist:
            name = row.get("name", row.get("channel", ""))
            platform_by_channel[name] = {k: v for k, v in row.items() if k not in ("name", "channel", "total")}

    # Transform channels
    channel_data = []
    for row in channels:
        ch_name = row.get("name", "")
        pub = row.get("published", 0)
        platforms = platform_by_channel.get(ch_name, {})
        channel_data.append({
            "ch": ch_name,
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": pub,
            "uploadedH": 0,
            "platforms": platforms,
            "noPublish": pub == 0,
        })

    # Build totals
    totals = {
        "totalCreated": total_created,
        "totalUploaded": total_uploaded,
        "totalPublished": total_published,
        "publishRate": str(round(publish_rate, 1)),
        "multiplier": str(round(multiplier, 1)),
        "activeChannels": active_ch,
    }

    unpublished = max(0, total_created - total_published)
    gap_pct = round((1 - publish_rate / 100) * 100, 1) if total_created > 0 else 0

    # Find peak month
    peak_month = ""
    peak_val = 0
    for m in monthly_data:
        if m["created"] > peak_val:
            peak_val = m["created"]
            peak_month = m["month"]

    # Find top channel
    top_ch = _get_metric_formatted(dashboard, "top_performing_channel", "")

    # Zero-pub months
    zero_pub_months = _get_metric(dashboard, "zero_pub_month_count", 0)

    # Strategic signals from data
    strategic_signals = [
        {
            "type": "crit" if gap_pct > 90 else "warn" if gap_pct > 70 else "ok",
            "tag": "\u26a0 CRITICAL" if gap_pct > 90 else "\u26a1 PATTERN",
            "num": f"{gap_pct}%",
            "text": "of processed content never published.",
            "stat": f"Created: {total_created:,} \u00b7 Published: {total_published:,} \u00b7 Gap: {unpublished:,}",
            "k": "c1",
            "expand": f"{unpublished:,} videos created and never distributed \u2014 representing an untapped asset pipeline.",
        },
    ]

    if zero_pub_months > 0:
        strategic_signals.append({
            "type": "warn",
            "tag": "\u26a1 PATTERN",
            "num": str(zero_pub_months),
            "text": "months had zero published output.",
            "stat": "Operational bottleneck, not volume issue",
            "k": "c2",
        })

    if peak_month:
        strategic_signals.append({
            "type": "ok",
            "tag": "\u2191 MOMENTUM",
            "num": f"{peak_val:,}",
            "text": f"outputs in {peak_month} \u2014 all-time peak.",
            "stat": f"Growth confirmed",
            "k": "c3",
        })

    # Phase 6: Add AI-generated strategic signals from recommendations
    try:
        from rec_engine.engine import generate_recommendations
        rec_data = generate_recommendations(force=False)
        if rec_data and rec_data.get("recommendations"):
            impact_map = {"high": "crit", "medium": "warn", "low": "ok"}
            category_map = {
                "channel_focus": "\u25c8 CHANNEL",
                "content_strategy": "\u22b9 CONTENT",
                "publishing": "\u22b3 PUBLISHING",
                "growth": "\u2191 GROWTH",
            }
            for rec in rec_data["recommendations"][:4]:
                strategic_signals.append({
                    "type": impact_map.get(rec.get("impact", "low"), "info"),
                    "tag": category_map.get(rec.get("category", ""), "\u25c8 AI"),
                    "num": rec.get("title", ""),
                    "text": rec.get("description", ""),
                    "stat": " \u00b7 ".join(rec.get("action_items", [])[:2]),
                    "k": rec.get("id", "ai"),
                    "expand": " ".join(rec.get("action_items", [])),
                    "ai_generated": True,
                })
    except Exception as e:
        logger.warning(f"Could not load recommendations for signals: {e}")

    return {
        "meta": {
            "tag": "EXECUTIVE COMMAND CENTRE",
            "title": "Executive Overview",
            "sub": "Platform performance at a glance \u2014 growth, red flags, and top-line KPIs.",
        },
        "monthlyData": monthly_data,
        "inputTypes": input_type_data,
        "channels": channel_data,
        "totals": totals,
        "toasts": [
            {
                "text": f"{gap_pct}% of processed content never gets published \u2014 {unpublished:,} videos created but not distributed.",
                "tone": "crit",
                "title": "Critical Finding",
                "delay": 1800,
            }
        ] if gap_pct > 50 else [],
        "hero": {"eyebrow": "AI PROCESSED \u2014 ALL TIME"},
        "statCards": [
            {"label": "UPLOADED", "sub": f"{_get_metric(dashboard, 'uploaded_hours', 0):.0f} hrs source footage", "color": "var(--ink2)", "accent": "card-ink", "valueColor": "var(--ink)"},
            {"label": "PUBLISHED", "sub": f"of {total_created:,} AI outputs distributed", "color": "var(--amber)", "accent": "card-amber", "valueColor": "var(--amber-lt)"},
            {"label": "PUB RATE", "sub": f"{gap_pct}% utilization gap", "color": "var(--red)", "accent": "card-red", "valueColor": "var(--red-lt)"},
        ],
        "pipelineRows": [
            {"l": "AI Multiplier", "key": "multiplier", "c": "var(--gold-lt)"},
            {"l": "Zero-pub months", "key": "zeroPublishMonths", "c": "var(--red-lt)"},
            {"l": "Active channels", "key": "activeChannels", "c": "var(--ink)"},
        ],
        "contextStrip": [
            {"label": "AI MULTIPLIER", "v": f"{multiplier}\u00d7", "sub": "inputs \u2192 AI outputs"},
            {"label": "TOP CHANNEL", "v": top_ch.split("(")[0].strip() if top_ch else "N/A", "sub": top_ch},
            {"label": "PEAK MONTH", "v": peak_month, "sub": f"{peak_val:,} outputs"},
            {"label": "PUBLISH GAP", "v": f"{gap_pct}%", "sub": f"{unpublished:,} never distributed"},
        ],
        "strategicSignals": strategic_signals,
        "monthlyChart": {
            "badge": f"{peak_month} peak" if peak_month else "",
            "legend": [["Uploaded", "var(--gold)"], ["Published", "var(--green)"]],
        },
        "statusDonut": [
            {"label": "Unpublished", "value": unpublished, "color": "#6a1818"},
            {"label": "Published", "value": total_published, "color": "#30b060"},
        ],
    }


def build_trends(dashboard: dict) -> dict:
    """Build trends section JSON."""
    monthly = _get_chart(dashboard, "monthly_trends")
    channels = _get_chart(dashboard, "channel_performance")
    users = _get_chart(dashboard, "user_performance")
    input_types = _get_chart(dashboard, "input_type_mix")

    monthly_data = []
    for row in monthly:
        monthly_data.append({
            "month": row.get("month", ""),
            "uploaded": row.get("uploaded", 0),
            "created": row.get("created", 0),
            "published": row.get("published", 0),
            "uploadedDur": 0,
            "createdDur": 0,
            "publishedDur": 0,
        })

    channel_metrics = [{"label": r.get("name", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in channels]
    user_data = [{"label": r.get("user", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in users]
    input_data = [{"label": r.get("name", ""), "uploaded": r.get("value", 0), "created": 0, "published": 0} for r in input_types]

    return {
        "meta": {
            "tag": "TEMPORAL ANALYSIS",
            "title": "Usage & Trend Analysis",
            "sub": "How volumes trend over time.",
        },
        "monthlyData": monthly_data,
        "kpiOptions": [
            {"k": "uploaded", "l": "Uploaded"},
            {"k": "created", "l": "Created"},
            {"k": "published", "l": "Published"},
            {"k": "pub_rate", "l": "Pub Rate"},
        ],
        "viewOptions": [["bar", "Bar Chart"], ["heatmap", "Heatmap"], ["treemap", "Treemap"], ["ternary", "Ternary"]],
        "heatData": [],
        "treemapColors": ["#b87514", "#c45e22", "#a87850", "#7a6858", "#5a7868", "#9b7058", "#6a8870", "#8a7060", "#b8a070", "#887060"],
        "channelMetrics": channel_metrics,
        "ternaryDatasets": {
            "channels": channel_metrics,
            "users": user_data,
            "inputtypes": input_data,
        },
        "ternaryAxisOptions": {
            "dataset": [["channels", f"Channels ({len(channel_metrics)})"], ["users", f"Users ({len(user_data)})"], ["inputtypes", "Input types"]],
            "common": ["uploaded", "created", "published", "pub_rate", "multiplier"],
            "right": ["created", "uploaded", "published", "pub_rate", "multiplier"],
        },
    }


def build_multidim(dashboard: dict) -> dict:
    """Build multidim section JSON."""
    input_types = _get_chart(dashboard, "input_type_mix")
    languages = _get_chart(dashboard, "language_breakdown")
    users = _get_chart(dashboard, "user_performance")
    channels = _get_chart(dashboard, "channel_performance")

    input_data = [{"type": r.get("name", ""), "uploaded": r.get("value", 0), "created": 0, "published": 0, "uploadedH": 0, "createdH": 0} for r in input_types]
    lang_data = [{"lang": r.get("lang", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0), "uploadedH": 0} for r in languages]
    user_data = [{"user": r.get("user", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0), "uploadedH": 0} for r in users]
    channel_metrics = [{"label": r.get("name", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in channels]

    channel_ternary = [{"label": r.get("name", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in channels]
    user_ternary = [{"label": r.get("user", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in users]
    input_ternary = [{"label": r.get("name", ""), "uploaded": r.get("value", 0), "created": 0, "published": 0} for r in input_types]

    return {
        "meta": {
            "tag": "CHANNEL \u00b7 USER \u00b7 PLATFORM INTELLIGENCE",
            "title": "Channel & User Intelligence",
            "sub": "Which channels and users drive volume, and how dimensions compare.",
        },
        "inputTypes": input_data,
        "languages": lang_data,
        "users": user_data,
        "channelMetrics": channel_metrics,
        "kpiOptions": [
            {"k": "uploaded", "l": "Uploaded"},
            {"k": "created", "l": "Created"},
            {"k": "published", "l": "Published"},
            {"k": "pub_rate", "l": "Pub Rate"},
        ],
        "viewOptions": [["bar", "Bar Chart"], ["heatmap", "Heatmap"], ["treemap", "Treemap"], ["ternary", "Ternary"]],
        "heatData": [],
        "treemapColors": ["#b87514", "#c45e22", "#a87850", "#7a6858", "#5a7868", "#9b7058", "#6a8870", "#8a7060", "#b8a070", "#887060"],
        "ternaryDatasets": {
            "channels": channel_ternary,
            "users": user_ternary,
            "inputtypes": input_ternary,
        },
        "ternaryAxisOptions": {
            "dataset": [["channels", f"Channels ({len(channel_ternary)})"], ["users", f"Users ({len(user_ternary)})"], ["inputtypes", "Input types"]],
            "common": ["uploaded", "created", "published", "pub_rate", "multiplier"],
            "right": ["created", "uploaded", "published", "pub_rate", "multiplier"],
        },
    }


def build_funnel(dashboard: dict) -> dict:
    """Build funnel section JSON."""
    funnel = _get_chart(dashboard, "funnel_data")
    input_types = _get_chart(dashboard, "input_type_mix")
    channels = _get_chart(dashboard, "channel_performance")

    total_uploaded = _get_metric(dashboard, "total_uploaded", 0)
    total_created = _get_metric(dashboard, "total_processed", 0)
    total_published = _get_metric(dashboard, "total_published", 0)

    return {
        "meta": {
            "tag": "CONTENT PIPELINE FLOW",
            "title": "Content Funnel & Flow",
            "sub": "Upload \u2192 Process \u2192 Publish pipeline analysis.",
        },
        "funnel": funnel if isinstance(funnel, list) else [],
        "inputTypes": [{"type": r.get("name", ""), "uploaded": r.get("value", 0), "created": 0, "published": 0} for r in input_types],
        "channels": [{"ch": r.get("name", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in channels],
        "totals": {
            "totalUploaded": total_uploaded,
            "totalCreated": total_created,
            "totalPublished": total_published,
        },
    }


def build_explorer(dashboard: dict) -> dict:
    """Build explorer section JSON."""
    users = _get_chart(dashboard, "user_performance")
    languages = _get_chart(dashboard, "language_breakdown")
    channels = _get_chart(dashboard, "channel_performance")

    return {
        "meta": {
            "tag": "DEEP DATA EXPLORER",
            "title": "Deep Explorer",
            "sub": "Granular data exploration across all dimensions.",
        },
        "users": [{"user": r.get("user", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in users],
        "languages": [{"lang": r.get("lang", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in languages],
        "channelMetrics": [{"label": r.get("name", ""), "uploaded": r.get("uploaded", 0), "created": r.get("created", 0), "published": r.get("published", 0)} for r in channels],
    }


def build_client(dashboard: dict) -> dict:
    """Build client section JSON."""
    total_created = _get_metric(dashboard, "total_processed", 0)
    total_uploaded = _get_metric(dashboard, "total_uploaded", 0)
    total_published = _get_metric(dashboard, "total_published", 0)
    publish_rate = _get_metric(dashboard, "publish_rate", 0)
    multiplier = _get_metric(dashboard, "amplification_ratio", 0)

    return {
        "meta": {
            "tag": "CLIENT OVERVIEW",
            "title": "Client Summary",
            "sub": "High-level performance summary for client reporting.",
        },
        "summaryCards": [
            {"label": "Total Uploaded", "value": total_uploaded},
            {"label": "Total Created", "value": total_created},
            {"label": "Total Published", "value": total_published},
            {"label": "Publish Rate", "value": f"{publish_rate}%"},
            {"label": "AI Multiplier", "value": f"{multiplier}x"},
        ],
        "pipelineSummary": {
            "uploaded": total_uploaded,
            "created": total_created,
            "published": total_published,
        },
    }


def build_app_shell(dashboard: dict) -> dict:
    """Build app-shell section JSON."""
    return {
        "sidebar": {
            "sections": [
                {"id": "executive", "label": "Executive Overview", "icon": "BarChart3"},
                {"id": "trends", "label": "Performance Trends", "icon": "TrendingUp"},
                {"id": "multidim", "label": "Multi-Dim Analysis", "icon": "Layers"},
                {"id": "funnel", "label": "Content Funnel", "icon": "Filter"},
                {"id": "explorer", "label": "Deep Explorer", "icon": "Search"},
                {"id": "client", "label": "Client View", "icon": "Users"},
            ],
        },
        "platformKpis": {
            "totalUploaded": _get_metric(dashboard, "total_uploaded", 0),
            "totalCreated": _get_metric(dashboard, "total_processed", 0),
            "totalPublished": _get_metric(dashboard, "total_published", 0),
            "publishRate": _get_metric(dashboard, "publish_rate", 0),
        },
    }
