"""
Analytics Summary Agent
Returns a multi-KPI summary for analytics overview queries.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger("analytics_summary_agent")


def _matches_summary_intent(query: str) -> bool:
    q = query.lower()
    triggers = [
        "summary",
        "analytics summary",
        "summary of analytics",
        "overview",
        "kpi summary",
        "metrics summary",
        "dashboard summary",
    ]
    return any(t in q for t in triggers)


def should_run(query: str, conversation_context: str = "") -> bool:
    return _matches_summary_intent(query)


def answer_summary(query: str, conversation_context: str = "") -> Dict[str, Any]:
    try:
        from analytics.analytics_engine import get_engine
        dashboard = get_engine().get_dashboard()
        metrics = dashboard.get("metrics", [])
    except Exception as e:
        logger.debug(f"Dashboard summary unavailable: {e}")
        metrics = []

    if not metrics:
        return {
            "answer": "Analytics summary is not available right now.",
            "artifacts": [],
            "datasets_used": [],
            "suggestions": [],
        }

    # Prefer a concise, top-level summary
    lines: List[str] = ["Analytics summary:"]
    for m in metrics[:10]:
        name = m.get("name") or m.get("id")
        formatted = m.get("formatted", m.get("value"))
        lines.append(f"- {name}: {formatted}")

    return {
        "answer": "\n".join(lines),
        "artifacts": [],
        "datasets_used": [],
        "suggestions": [],
    }
