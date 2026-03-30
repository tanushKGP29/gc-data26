"""
Recommendation Engine - Generates strategic content recommendations from analytics data.

Uses the existing LLM pipeline (think_complete) to analyze KPI values, chart data,
and dataset statistics, producing structured recommendations.

In-memory cache keyed by hash of metric values avoids redundant LLM calls.
"""
import json
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("rec_engine")

# Path to the analytics dashboard JSON (written by analytics_engine)
_AGENT_DIR = Path(__file__).resolve().parent.parent.parent
DASHBOARD_PATH = _AGENT_DIR / "data" / "analytics_dashboard.json"

# In-memory cache
_cache: Optional[dict] = None
_cache_hash: Optional[str] = None


def _load_dashboard() -> Optional[dict]:
    """Load the analytics dashboard JSON."""
    if not DASHBOARD_PATH.exists():
        logger.warning(f"Dashboard not found at {DASHBOARD_PATH}")
        return None
    try:
        return json.loads(DASHBOARD_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Failed to load dashboard: {e}")
        return None


def _compute_hash(metrics: list) -> str:
    """Hash metric values to detect changes."""
    key_data = json.dumps(
        [{m.get("id"): m.get("value")} for m in metrics],
        sort_keys=True, default=str
    )
    return hashlib.md5(key_data.encode()).hexdigest()


def _build_data_context(dashboard: dict) -> str:
    """Build a text summary of all analytics data for the LLM."""
    metrics = dashboard.get("metrics", [])
    chart_data = dashboard.get("chart_data", {})

    # KPI summary
    kpi_lines = []
    for m in metrics:
        kpi_lines.append(f"- {m.get('name', m.get('id'))}: {m.get('formatted', m.get('value'))} (category: {m.get('category', 'unknown')})")
    kpi_summary = "\n".join(kpi_lines) if kpi_lines else "No KPIs available."

    # Chart/trend summary
    chart_lines = []
    monthly = chart_data.get("monthly_trends", [])
    if monthly:
        chart_lines.append("Monthly Trends (recent months):")
        for row in monthly[-6:]:
            chart_lines.append(f"  {row.get('month', '?')}: uploaded={row.get('uploaded', 0)}, created={row.get('created', 0)}, published={row.get('published', 0)}")

    channel_perf = chart_data.get("channel_performance", [])
    if channel_perf:
        chart_lines.append("Channel Performance:")
        for ch in channel_perf[:10]:
            chart_lines.append(f"  {ch.get('name', '?')}: uploaded={ch.get('uploaded', 0)}, created={ch.get('created', 0)}, published={ch.get('published', 0)}, rate={ch.get('rate', 0):.2f}%")

    platform = chart_data.get("platform_distribution", [])
    if platform:
        chart_lines.append("Platform Distribution:")
        for p in platform:
            chart_lines.append(f"  {p.get('name', '?')}: {p.get('value', 0)}")

    chart_summary = "\n".join(chart_lines) if chart_lines else "No chart data available."

    # Dataset stats
    dataset_sources = dashboard.get("dataset_sources", {})
    stats_lines = [f"- {role}: {info.get('filename', 'unknown')}" for role, info in dataset_sources.items()]
    dataset_stats = "\n".join(stats_lines) if stats_lines else "Dataset sources not available."

    return kpi_summary, dataset_stats, chart_summary


def _call_llm(kpi_summary: str, dataset_stats: str, chart_summary: str) -> str:
    """Call the LLM with the recommendation prompt."""
    import sys
    _backend_dir = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(_backend_dir))
    sys.path.insert(0, str(_backend_dir.parent))

    from llm.groq_client import think_complete
    from rec_engine.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

    user_prompt = USER_PROMPT_TEMPLATE.format(
        kpi_summary=kpi_summary,
        dataset_stats=dataset_stats,
        chart_summary=chart_summary,
    )

    response = think_complete(
        [{"role": "user", "content": user_prompt}],
        system_prompt=SYSTEM_PROMPT,
        temperature=0.4,
        max_tokens=4096,
    )
    return response


def _parse_response(raw: str) -> Optional[dict]:
    """Parse the LLM JSON response, handling common formatting issues."""
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    logger.error(f"Failed to parse LLM response as JSON: {text[:200]}...")
    return None


def generate_recommendations(force: bool = False) -> dict:
    """
    Generate strategic recommendations from analytics data.

    Args:
        force: If True, bypass cache and regenerate.

    Returns:
        Dict with recommendations, insights, and metadata.
    """
    global _cache, _cache_hash

    dashboard = _load_dashboard()
    if not dashboard:
        if _cache:
            return _cache
        return {"error": "No analytics data available", "recommendations": [], "insights": []}

    metrics = dashboard.get("metrics", [])
    current_hash = _compute_hash(metrics)

    # Return cache if data hasn't changed
    if not force and _cache and _cache_hash == current_hash:
        logger.info("Returning cached recommendations (data unchanged)")
        return _cache

    logger.info("Generating new recommendations via LLM...")
    try:
        kpi_summary, dataset_stats, chart_summary = _build_data_context(dashboard)
        raw = _call_llm(kpi_summary, dataset_stats, chart_summary)
        parsed = _parse_response(raw)

        if not parsed:
            if _cache:
                logger.warning("LLM returned invalid JSON, returning cached recommendations")
                return _cache
            return {"error": "Failed to parse recommendations", "recommendations": [], "insights": []}

        # Add metadata
        result = {
            "generated_at": datetime.now().isoformat(),
            "data_hash": current_hash,
            "summary": parsed.get("summary", ""),
            "recommendations": parsed.get("recommendations", []),
            "insights": parsed.get("insights", []),
        }

        # Assign IDs if missing
        for i, rec in enumerate(result["recommendations"]):
            if not rec.get("id"):
                rec["id"] = f"rec_{i+1:03d}"

        _cache = result
        _cache_hash = current_hash
        logger.info(f"Generated {len(result['recommendations'])} recommendations, {len(result['insights'])} insights")
        return result

    except Exception as e:
        logger.error(f"Recommendation generation failed: {e}")
        if _cache:
            return _cache
        return {"error": str(e), "recommendations": [], "insights": []}
