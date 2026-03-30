"""
Intent Router - LLM-based semantic intent classification.

Routes user queries to the appropriate agent based on understanding, not keywords.
"""
import json
import re
import logging
from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum

from llm.groq_client import fast_complete

logger = logging.getLogger("intent_router")


class Intent(str, Enum):
    """All possible intents the router can classify."""
    GREETING = "greeting"           # Hello, help, what can you do
    LIST_DATA = "list_data"         # What datasets are available
    DESCRIBE_DATA = "describe_data" # Describe schema/columns of a dataset
    KPI_LOOKUP = "kpi_lookup"       # Single metric lookup (total videos, publish rate)
    ANALYTICS_SUMMARY = "summary"   # Overview of all KPIs/dashboard
    RECOMMENDATION = "recommend"    # Strategic advice, what should we do
    EXPLANATION = "explain"         # Explain a concept, clarify previous result
    ANALYSIS = "analyze"            # Custom analysis requiring code (charts, comparisons, trends)


@dataclass
class RouterDecision:
    """Result of intent classification."""
    intent: Intent
    confidence: float
    reasoning: str
    entities: Dict[str, Any]  # Extracted entities (dataset names, metrics, time ranges, etc.)


# System prompt for the intent classifier
ROUTER_SYSTEM_PROMPT = """You are an intent classifier for a video analytics platform called Frammer AI.

Your job is to understand what the user wants and classify their request into ONE of these intents:

## INTENTS:

1. **greeting** - User is saying hello, asking for help, or asking what the assistant can do
   Examples: "hi", "hello", "what can you do?", "help me", "who are you?"

2. **list_data** - User wants to know what datasets/tables are available
   Examples: "what data do you have?", "show me available datasets", "list tables", "what can I analyze?"

3. **describe_data** - User wants to know the schema/columns/structure of a specific dataset
   Examples: "describe the users table", "what columns are in channel_summary?", "show schema for monthly"

4. **kpi_lookup** - User is asking for the COMPUTED VALUE of a specific metric/KPI
   These are value lookups — the user wants a number, not an explanation.
   Examples: "what's the total uploaded?", "show me publish rate", "how many channels?", "what's the amplification ratio?"

5. **summary** - User wants an overview/summary of ALL analytics or the dashboard
   Examples: "give me a summary", "analytics overview", "dashboard summary", "show all KPIs"

6. **recommend** - User wants strategic recommendations, advice, insights, or action items
   Examples: "what should we focus on?", "give me recommendations", "what insights do you have?", "suggest next steps"

7. **explain** - User wants UNDERSTANDING of a concept, metric, term, or previous result
   This includes explaining KPI concepts, metric definitions, formulas, or clarifying results.
   Examples: "explain viral velocity score", "what does amplification ratio mean?", "clarify the last result", "what is publish rate concept?"
   KEY DISTINCTION from kpi_lookup: "explain X" / "what does X mean?" → explain (wants understanding). "what is X?" / "show me X" → kpi_lookup (wants the number).

8. **analyze** - User wants CUSTOM data analysis that requires computation/code
   This includes: charts, visualizations, comparisons, trends, filtering, grouping, top N, rankings, breakdowns, forecasts
   Examples: 
   - "show me top 5 users by video count"
   - "compare channels by publish rate"
   - "chart monthly trends"
   - "which channel has the most uploads?"
   - "breakdown by language"
   - "show users with channel breakdown"
   - "trend of uploads over time"
   - "who are the top performers?"

## IMPORTANT RULES:
- **kpi_lookup** is for SINGLE existing metrics. If user asks for "top 5" or "compare" or "breakdown" → that's **analyze**
- **analyze** is for any request needing charts, comparisons, rankings, filtering, grouping, or visualization
- If unsure between kpi_lookup and analyze, prefer **analyze** (it's more capable)
- "Show me" or "give me" followed by a metric name → kpi_lookup
- "Show me" followed by "chart/graph/trend/top/comparison" → analyze

## OUTPUT FORMAT:
Respond with JSON only:
{
    "intent": "greeting|list_data|describe_data|kpi_lookup|summary|recommend|explain|analyze",
    "confidence": 0.0 to 1.0,
    "reasoning": "brief explanation of why this intent",
    "entities": {
        "datasets": ["dataset names mentioned"],
        "metrics": ["metric names mentioned"],
        "filters": {"key": "value"},
        "time_range": "if mentioned",
        "top_n": number or null,
        "chart_type": "if visualization requested"
    }
}"""


def classify_intent(
    query: str,
    conversation_context: str = "",
    available_datasets: List[str] = None,
    available_kpis: List[str] = None,
) -> RouterDecision:
    """
    Classify user intent using LLM.
    
    Args:
        query: User's question
        conversation_context: Previous conversation for resolving references
        available_datasets: List of dataset names for context
        available_kpis: List of KPI names for context
    
    Returns:
        RouterDecision with intent, confidence, reasoning, and extracted entities
    """
    # Build context sections
    context_section = ""
    if conversation_context:
        context_section = f"""
CONVERSATION HISTORY (for resolving "it", "that", "same", etc.):
{conversation_context}
"""

    datasets_section = ""
    if available_datasets:
        datasets_section = f"""
AVAILABLE DATASETS: {', '.join(available_datasets[:10])}
"""

    kpis_section = ""
    if available_kpis:
        kpis_section = f"""
AVAILABLE KPIs: {', '.join(available_kpis[:15])}
"""

    prompt = f"""{context_section}{datasets_section}{kpis_section}
USER QUERY: {query}

Classify this query into the appropriate intent. Think about what the user REALLY wants."""

    logger.debug(f"Classifying intent for: {query[:80]}...")
    
    response = fast_complete(
        [{"role": "user", "content": prompt}],
        system_prompt=ROUTER_SYSTEM_PROMPT,
        temperature=0.1,
        max_tokens=500,
    )
    
    # Parse response
    try:
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            data = json.loads(match.group())
            
            intent_str = data.get("intent", "analyze").lower().strip()
            
            # Map to Intent enum
            intent_map = {
                "greeting": Intent.GREETING,
                "list_data": Intent.LIST_DATA,
                "describe_data": Intent.DESCRIBE_DATA,
                "kpi_lookup": Intent.KPI_LOOKUP,
                "summary": Intent.ANALYTICS_SUMMARY,
                "recommend": Intent.RECOMMENDATION,
                "explain": Intent.EXPLANATION,
                "analyze": Intent.ANALYSIS,
            }
            
            intent = intent_map.get(intent_str, Intent.ANALYSIS)
            confidence = float(data.get("confidence", 0.8))
            reasoning = data.get("reasoning", "")
            entities = data.get("entities", {})
            
            logger.info(f"Intent: {intent.value} (confidence: {confidence:.2f}) - {reasoning[:50]}")
            
            return RouterDecision(
                intent=intent,
                confidence=confidence,
                reasoning=reasoning,
                entities=entities,
            )
    except Exception as e:
        logger.warning(f"Failed to parse intent response: {e}")
    
    # Fallback to analyze (safest default)
    logger.info("Intent: analyze (fallback)")
    return RouterDecision(
        intent=Intent.ANALYSIS,
        confidence=0.5,
        reasoning="fallback due to parse error",
        entities={},
    )


def get_available_context() -> tuple:
    """Get available datasets and KPIs for context."""
    datasets = []
    kpis = []
    
    try:
        from dbms import list_datasets
        ds_list = list_datasets()
        datasets = [d["name"] for d in ds_list]
    except Exception:
        pass
    
    try:
        from pathlib import Path
        kpi_path = Path(__file__).parent / "analytics" / "kpi_registry.json"
        if kpi_path.exists():
            registry = json.loads(kpi_path.read_text(encoding="utf-8"))
            kpis = [k["name"] for k in registry.get("kpis", [])]
    except Exception:
        pass
    
    return datasets, kpis


def route_query(query: str, conversation_context: str = "") -> Dict[str, Any]:
    """
    Main routing function - classifies intent and returns routing decision.
    
    Returns:
        {
            "route": "greeting|list_data|describe_data|kpi|summary|recommend|explain|planner",
            "intent": Intent enum value,
            "confidence": float,
            "reasoning": str,
            "entities": dict,
        }
    """
    datasets, kpis = get_available_context()
    
    decision = classify_intent(
        query=query,
        conversation_context=conversation_context,
        available_datasets=datasets,
        available_kpis=kpis,
    )
    
    # Map intent to route (matching langgraph_orchestrator node names)
    route_map = {
        Intent.GREETING: "planner",      # planner handles greetings
        Intent.LIST_DATA: "planner",     # planner handles list_data
        Intent.DESCRIBE_DATA: "planner", # planner handles describe_data
        Intent.KPI_LOOKUP: "kpi",
        Intent.ANALYTICS_SUMMARY: "summary",
        Intent.RECOMMENDATION: "recommend",
        Intent.EXPLANATION: "explain",
        Intent.ANALYSIS: "planner",
    }
    
    route = route_map.get(decision.intent, "planner")
    
    return {
        "route": route,
        "intent": decision.intent,
        "confidence": decision.confidence,
        "reasoning": decision.reasoning,
        "entities": decision.entities,
    }
