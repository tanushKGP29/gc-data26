"""
KPI Agent
Matches user queries to KPI definitions and computes results.
"""
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from llm.groq_client import fast_complete
from analytics.kpi_executor import KPIExecutor

logger = logging.getLogger("kpi_agent")

_BACKEND_DIR = Path(__file__).parent
_AGENT_DIR = _BACKEND_DIR.parent
_KPI_REGISTRY_PATH = _BACKEND_DIR / "analytics" / "kpi_registry.json"
_DATASET_PATHS = _AGENT_DIR / "data" / "saved_analytics" / "dataset_paths.json"


def _load_kpi_registry() -> Dict[str, Any]:
    return json.loads(_KPI_REGISTRY_PATH.read_text(encoding="utf-8"))


def _get_kpi_index() -> List[Dict[str, str]]:
    registry = _load_kpi_registry()
    items = []
    for kpi in registry.get("kpis", []):
        items.append({
            "id": kpi.get("id", ""),
            "name": kpi.get("name", ""),
            "description": kpi.get("description", ""),
            "category": kpi.get("category", ""),
        })
    return items


def _heuristic_match(query: str) -> Optional[str]:
    q = query.lower()
    kpis = _get_kpi_index()

    # Direct id match
    for k in kpis:
        if k["id"] and k["id"].lower() in q:
            return k["id"]

    # Name keyword match
    for k in kpis:
        name = k["name"].lower()
        if name and all(token in q for token in name.split()[:2]):
            return k["id"]

    return None


def classify_kpi(query: str, conversation_context: str = "") -> Dict[str, Any]:
    """Identify the KPI id best matching the query."""
    context_section = ""
    if conversation_context:
        context_section = f"\nRECENT CONTEXT:\n{conversation_context}\n"

    kpi_index = _get_kpi_index()
    kpi_list = "\n".join([
        f"- {k['id']}: {k['name']} ({k['description']})"
        for k in kpi_index
    ])

    prompt = f"""Choose the best KPI for this user request.

    {context_section}
    USER QUERY: {query}

    AVAILABLE KPIS:
    {kpi_list}

    Respond with JSON only:
    {{
        "match": true/false,
        "kpi_id": "kpi_id_or_empty",
        "reason": "short reason",
        "confidence": 0.0
    }}"""

    response = fast_complete([{"role": "user", "content": prompt}], temperature=0.1)
    raw = response.strip()

    try:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
            kpi_id = data.get("kpi_id", "").strip()
            if data.get("match") and kpi_id:
                return {
                    "match": True,
                    "kpi_id": kpi_id,
                    "reason": data.get("reason", ""),
                    "confidence": float(data.get("confidence", 0.0)),
                }
    except Exception as e:
        logger.debug(f"KPI classifier parse failed: {e}")

    fallback = _heuristic_match(query)
    if fallback:
        return {"match": True, "kpi_id": fallback, "reason": "heuristic", "confidence": 0.0}

    return {"match": False, "kpi_id": "", "reason": "no match", "confidence": 0.0}


def _load_dataset_paths() -> Dict[str, str]:
    if _DATASET_PATHS.exists():
        try:
            return json.loads(_DATASET_PATHS.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Failed to read dataset_paths.json: {e}")
    return {}


def compute_kpi_by_id(kpi_id: str) -> Optional[Dict[str, Any]]:
    executor = KPIExecutor()
    executor.set_dataset_paths(_load_dataset_paths())
    return executor.compute_kpi_by_id(kpi_id)


def answer_kpi_query(query: str, conversation_context: str = "") -> Dict[str, Any]:
    """Answer a KPI question by computing the KPI result."""
    match = classify_kpi(query, conversation_context=conversation_context)
    if not match.get("match"):
        return {
            "answer": "I could not map that request to a specific KPI.",
            "artifacts": [],
            "datasets_used": [],
            "suggestions": [],
        }

    kpi_id = match.get("kpi_id")
    kpi = compute_kpi_by_id(kpi_id)
    if not kpi:
        return {
            "answer": f"KPI '{kpi_id}' could not be computed with the available data.",
            "artifacts": [],
            "datasets_used": [],
            "suggestions": [],
        }

    answer = f"{kpi['name']}: {kpi['formatted']}"
    if kpi.get("description"):
        answer += f". {kpi['description']}"

    return {
        "answer": answer,
        "artifacts": [],
        "datasets_used": kpi.get("dataset_sources", []),
        "suggestions": [],
        "kpi": kpi,
    }


def can_answer(query: str, conversation_context: str = "", min_confidence: float = 0.6) -> bool:
    match = classify_kpi(query, conversation_context=conversation_context)
    return bool(match.get("match")) and float(match.get("confidence", 0.0)) >= min_confidence
