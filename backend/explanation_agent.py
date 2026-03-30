"""
Explanation Agent — Multi-phase CoT reasoning with KPI registry grounding.

Handles: "explain X", "what does X mean?", "clarify that result"
Does NOT compute KPI values — that's the KPI agent's job.
"""
import json
import re
import logging
from typing import Any, Dict

from llm.groq_client import fast_complete, think_complete

logger = logging.getLogger("explanation_agent")


# ── Phase 1: UNDERSTAND ──

def _phase1_understand(query: str, conversation_context: str, registry_context: str) -> Dict[str, Any]:
    """Classify what the user wants explained and assess clarity."""

    context_section = ""
    if conversation_context:
        context_section = f"\nRECENT CONVERSATION:\n{conversation_context}\n"

    prompt = f"""You are classifying what a user wants explained in a video analytics platform.

TRACKED KPIs IN SYSTEM:
{registry_context}

{context_section}
USER QUERY: {query}

Classify into one of these types:
1. "kpi_concept" — User wants to understand a metric, KPI, score, or formula
   (e.g., "explain viral velocity score", "what does publish rate mean?", "what is amplification ratio?")
2. "result_clarification" — User wants clarification of a previous result or chart
   (e.g., "what did you mean by that?", "clarify the last chart", "explain that number")
3. "general_concept" — User wants explanation of a general analytics concept, not a specific metric
   (e.g., "what is content funnel analysis?", "explain A/B testing")
4. "unclear" — Cannot determine what the user wants from the query alone

Respond with JSON only:
{{
    "explain_type": "kpi_concept|result_clarification|general_concept|unclear",
    "extracted_term": "the metric/concept name the user is asking about, or empty if unclear",
    "clarity_score": 0.0-1.0,
    "reasoning": "one-line chain of thought"
}}"""

    try:
        response = fast_complete([{"role": "user", "content": prompt}], temperature=0.1)
        m = re.search(r"\{.*\}", response.strip(), re.DOTALL)
        if m:
            data = json.loads(m.group())
            return {
                "explain_type": data.get("explain_type", "general_concept"),
                "extracted_term": data.get("extracted_term", ""),
                "clarity_score": float(data.get("clarity_score", 0.5)),
                "reasoning": data.get("reasoning", ""),
            }
    except Exception as e:
        logger.debug(f"Phase 1 parse failed: {e}")

    # Heuristic fallback
    q = query.lower()
    kpi_signals = ["kpi", "metric", "rate", "ratio", "score", "index", "growth",
                   "total", "average", "percentage", "formula", "means", "mean"]
    if any(s in q for s in kpi_signals):
        return {"explain_type": "kpi_concept", "extracted_term": query, "clarity_score": 0.6, "reasoning": "heuristic"}
    return {"explain_type": "general_concept", "extracted_term": query, "clarity_score": 0.5, "reasoning": "heuristic"}


# ── Phase 2: CLARITY CHECK ──

def _phase2_clarity_check(understand_result: Dict[str, Any]) -> Dict[str, Any]:
    """Decide if we need to ask the user for clarification.
    Only triggers when the query is genuinely unparseable."""
    if understand_result["explain_type"] == "unclear" and understand_result["clarity_score"] < 0.4:
        from kpi_registry_tool import list_all
        sample_kpis = [k["name"] for k in list_all()[:6]]
        suggestions = sample_kpis

        return {
            "needs_clarification": True,
            "question": (
                "Could you clarify what you'd like me to explain? For example:\n"
                f"- A specific metric ({', '.join(suggestions[:3])})\n"
                "- A previous result or chart\n"
                "- A general analytics concept"
            ),
            "suggestions": [f"Explain {s}" for s in suggestions[:4]],
        }

    return {"needs_clarification": False}


# ── Phase 3: RETRIEVE ──

def _phase3_retrieve(extracted_term: str) -> Dict[str, Any]:
    """Search the KPI knowledge base for relevant KPIs."""
    from kpi_registry_tool import fuzzy_match, search_kpis

    match_result = fuzzy_match(extracted_term)
    search_results = search_kpis(extracted_term, top_n=5)

    # Build grounding context from retrieved KPIs
    grounding_lines = []
    if match_result["found"] and match_result["kpi_config"]:
        kpi = match_result["kpi_config"]
        grounding_lines.append(
            f"EXACT MATCH — {kpi['name']} (id: {kpi['id']})\n"
            f"  Description: {kpi['description']}\n"
            f"  Category: {kpi['category']}\n"
            f"  Formula: {kpi['formula']}\n"
            f"  Unit: {kpi['unit']}\n"
            f"  Datasets: {', '.join(kpi['datasets'])}"
        )

    for kpi in match_result.get("similar", []):
        if kpi["id"] != match_result.get("kpi_id", ""):
            grounding_lines.append(
                f"RELATED — {kpi['name']} (id: {kpi['id']}): {kpi['description']} "
                f"[Formula: {kpi['formula']}] [{kpi['category']}]"
            )

    # Add search results not already included
    seen_ids = {match_result.get("kpi_id", "")} | {k["id"] for k in match_result.get("similar", [])}
    for kpi in search_results:
        if kpi["id"] not in seen_ids:
            grounding_lines.append(
                f"RELATED — {kpi['name']} (id: {kpi['id']}): {kpi['description']} "
                f"[Formula: {kpi['formula']}] [{kpi['category']}]"
            )
            seen_ids.add(kpi["id"])

    return {
        "found_in_registry": match_result["found"],
        "matched_kpi": match_result.get("kpi_config"),
        "grounding_context": "\n".join(grounding_lines) if grounding_lines else "No matching KPIs found in registry.",
        "similar_kpis": match_result.get("similar", []) or search_results[:3],
    }


# ── Phase 4: EXPLAIN ──

def _phase4_explain(
    query: str,
    explain_type: str,
    extracted_term: str,
    retrieve_result: Dict[str, Any],
    conversation_context: str,
) -> str:
    """Generate a grounded explanation using think_complete."""

    context_section = ""
    if conversation_context:
        context_section = f"\nRECENT CONVERSATION:\n{conversation_context}\n"

    if explain_type == "kpi_concept":
        grounding = retrieve_result.get("grounding_context", "")
        found = retrieve_result.get("found_in_registry", False)

        if found:
            system_prompt = (
                "You are an analytics explanation assistant with access to the platform's KPI registry. "
                "The user is asking about a metric that IS tracked in the system. "
                "Explain it using the registry definition below — cover what it measures, why it matters, "
                "and how it's calculated (reference the formula). Keep it 3-5 sentences. "
                "Do NOT make up values — only explain the concept and formula."
            )
        else:
            system_prompt = (
                "You are an analytics explanation assistant with access to the platform's KPI registry. "
                "The user is asking about a metric that is NOT directly tracked in the system. "
                "Explain the general concept of what they're asking about (2-3 sentences), "
                "then mention that this specific metric isn't tracked in the system, "
                "and suggest the most relevant tracked metrics from the registry below. "
                "For each suggested metric, briefly explain how it relates to what they asked. "
                "Do NOT make up values."
            )

        prompt = f"""KPI REGISTRY CONTEXT:
{grounding}

{context_section}
USER QUERY: {query}
EXTRACTED TERM: {extracted_term}

Provide a clear, grounded explanation."""

    elif explain_type == "result_clarification":
        system_prompt = (
            "You are an analytics assistant. The user wants clarification on a previous result or chart. "
            "Use the conversation context to understand what they're referring to. "
            "Explain in plain language. If context is insufficient, say so briefly."
        )
        prompt = f"""{context_section}
USER QUERY: {query}

Clarify the user's question about the previous result."""

    else:  # general_concept
        system_prompt = (
            "You are an analytics explanation assistant. "
            "Explain the concept the user is asking about in plain language. "
            "Keep it clear and concise (3-5 sentences). "
            "If it relates to video analytics, content publishing, or media metrics, provide relevant context."
        )
        prompt = f"""{context_section}
USER QUERY: {query}

Explain this concept clearly."""

    response = think_complete(
        [{"role": "user", "content": prompt}],
        system_prompt=system_prompt,
        temperature=0.4,
        max_tokens=800,
    )
    return response.strip()


# ── Main entry point ──

def explain_query(query: str, conversation_context: str = "") -> Dict[str, Any]:
    """Multi-phase CoT explanation with KPI registry grounding."""
    from kpi_registry_tool import build_registry_context

    registry_context = build_registry_context()

    # Phase 1: Understand
    understand = _phase1_understand(query, conversation_context, registry_context)
    logger.info(f"Phase 1: type={understand['explain_type']}, term={understand['extracted_term']}, clarity={understand['clarity_score']}")

    # Phase 2: Clarity check
    clarity = _phase2_clarity_check(understand)
    if clarity["needs_clarification"]:
        return {
            "answer": clarity["question"],
            "artifacts": [],
            "datasets_used": [],
            "suggestions": clarity.get("suggestions", []),
        }

    # Phase 3: Retrieve (for KPI concepts)
    retrieve_result = {}
    if understand["explain_type"] == "kpi_concept" and understand["extracted_term"]:
        retrieve_result = _phase3_retrieve(understand["extracted_term"])
        logger.info(f"Phase 3: found={retrieve_result.get('found_in_registry')}, matched={retrieve_result.get('matched_kpi', {}).get('id', 'none') if retrieve_result.get('matched_kpi') else 'none'}")

    # Phase 4: Explain
    answer = _phase4_explain(
        query=query,
        explain_type=understand["explain_type"],
        extracted_term=understand.get("extracted_term", ""),
        retrieve_result=retrieve_result,
        conversation_context=conversation_context,
    )

    # Phase 5: Assemble
    suggestions = []
    if understand["explain_type"] == "kpi_concept":
        similar = retrieve_result.get("similar_kpis", [])
        for kpi in similar[:3]:
            suggestions.append(f"What is the {kpi['name'].lower()}?")
        if retrieve_result.get("found_in_registry") and retrieve_result.get("matched_kpi"):
            suggestions.insert(0, f"Calculate {retrieve_result['matched_kpi']['name'].lower()}")

    return {
        "answer": answer,
        "artifacts": [],
        "datasets_used": [],
        "suggestions": suggestions,
    }


# ── Legacy helpers (kept for backward compat) ──

def classify_route(query: str, conversation_context: str = "") -> Dict[str, Any]:
    """Classify whether to explain or analyze. Used by other agents."""
    q = query.lower()
    explain_triggers = ["explain", "what does", "what do you mean", "clarify", "meaning of", "interpret"]
    if any(t in q for t in explain_triggers):
        return {"route": "explain", "reason": "explain keyword", "confidence": 0.8}
    return {"route": "analyze", "reason": "default", "confidence": 0.5}
