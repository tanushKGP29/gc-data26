"""
Recommendation Agent
Generates strategic recommendations from analytics data on request.
"""
import logging
from typing import Any, Dict

from rec_engine.engine import generate_recommendations

logger = logging.getLogger("recommendation_agent")


def _matches_recommendation_intent(query: str) -> bool:
    q = query.lower()
    triggers = [
        "recommend",
        "recommendation",
        "insight",
        "insights",
        "strategy",
        "strategic",
        "what should we do",
        "next steps",
        "action items",
        "suggest",
        "suggestions",
    ]
    return any(t in q for t in triggers)


def should_run(query: str, conversation_context: str = "") -> bool:
    """Lightweight intent check for recommendation requests."""
    return _matches_recommendation_intent(query)


def answer_recommendations(query: str, conversation_context: str = "") -> Dict[str, Any]:
    """Generate and format recommendations for the user."""
    result = generate_recommendations(force=False)
    if result.get("error"):
        return {
            "answer": f"Recommendations are not available: {result['error']}",
            "artifacts": [],
            "datasets_used": [],
            "suggestions": [],
        }

    recs = result.get("recommendations", [])
    insights = result.get("insights", [])
    summary = result.get("summary", "")

    lines = []
    if summary:
        lines.append(summary)

    if recs:
        lines.append("Top recommendations:")
        for rec in recs[:5]:
            title = rec.get("title", rec.get("id", "Recommendation"))
            desc = rec.get("description", "")
            if desc:
                lines.append(f"- {title}: {desc}")
            else:
                lines.append(f"- {title}")

    if insights:
        lines.append("Key insights:")
        for insight in insights[:5]:
            lines.append(f"- {insight}")

    answer = "\n".join(lines) if lines else "No recommendations available."

    return {
        "answer": answer,
        "artifacts": [],
        "datasets_used": [],
        "suggestions": [],
        "recommendations": recs,
        "insights": insights,
    }
