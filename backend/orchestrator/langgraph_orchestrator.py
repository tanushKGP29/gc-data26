"""
LangGraph orchestrator for chat routing.

Uses LLM-based intent classification for semantic understanding.
"""
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END


class ChatState(TypedDict, total=False):
    query: str
    conversation_context: str
    forced_route: str
    route: str
    visualize_intent: bool
    kpi_decision: Dict[str, Any]
    entities: Dict[str, Any]
    result: Dict[str, Any]


def _route_query(state: ChatState) -> ChatState:
    """Route query using LLM-based intent classification."""
    query = state.get("query", "")
    context = state.get("conversation_context", "")
    forced_route = (state.get("forced_route") or "").lower().strip()

    # Handle forced routes (from frontend mode selection)
    if forced_route:
        if forced_route == "analytics":
            forced_route = "planner"
        allowed = {"explain", "kpi", "planner", "summary", "recommend"}
        if forced_route in allowed:
            return {
                "route": forced_route,
                "kpi_decision": {"match": False, "kpi_id": "", "confidence": 0.0},
                "visualize_intent": False,
                "entities": {},
            }

    # Use LLM-based intent router
    from intent_router import route_query

    routing = route_query(query, conversation_context=context)
    route = routing["route"]
    entities = routing.get("entities", {})

    # Check for visualization intent from entities
    visualize_intent = bool(entities.get("chart_type")) or bool(entities.get("top_n"))

    return {
        "route": route,
        "kpi_decision": {"match": False, "kpi_id": "", "confidence": 0.0},
        "visualize_intent": visualize_intent,
        "entities": entities,
    }


def _explain_node(state: ChatState) -> ChatState:
    from explanation_agent import explain_query
    result = explain_query(state.get("query", ""), conversation_context=state.get("conversation_context", ""))
    return {"result": result}


def _recommend_node(state: ChatState) -> ChatState:
    from recommendation_agent import answer_recommendations
    result = answer_recommendations(state.get("query", ""), conversation_context=state.get("conversation_context", ""))
    return {"result": result}


def _summary_node(state: ChatState) -> ChatState:
    from analytics_summary_agent import answer_summary
    result = answer_summary(state.get("query", ""), conversation_context=state.get("conversation_context", ""))
    return {"result": result}


def _kpi_node(state: ChatState) -> ChatState:
    from kpi_agent import answer_kpi_query
    result = answer_kpi_query(state.get("query", ""), conversation_context=state.get("conversation_context", ""))
    return {"result": result}


def _planner_node(state: ChatState) -> ChatState:
    from planner import run_planner
    result = run_planner(state.get("query", ""), conversation_context=state.get("conversation_context", ""))
    return {"result": result}


def _route_to_node(state: ChatState) -> str:
    route = state.get("route", "planner")
    if route == "explain":
        return "explain"
    if route == "summary":
        return "summary"
    if route == "recommend":
        return "recommend"
    if route == "kpi":
        return "kpi"
    return "planner"


def build_graph():
    graph = StateGraph(ChatState)

    graph.add_node("route", _route_query)
    graph.add_node("explain", _explain_node)
    graph.add_node("summary", _summary_node)
    graph.add_node("recommend", _recommend_node)
    graph.add_node("kpi", _kpi_node)
    graph.add_node("planner", _planner_node)

    graph.set_entry_point("route")

    graph.add_conditional_edges("route", _route_to_node, {
        "explain": "explain",
        "summary": "summary",
        "recommend": "recommend",
        "kpi": "kpi",
        "planner": "planner",
    })

    graph.add_edge("explain", END)
    graph.add_edge("summary", END)
    graph.add_edge("recommend", END)
    graph.add_edge("kpi", END)
    graph.add_edge("planner", END)

    return graph.compile()


_GRAPH = None


def run_chat_graph(query: str, conversation_context: str = "", forced_route: str = "") -> Dict[str, Any]:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()

    state: ChatState = {
        "query": query,
        "conversation_context": conversation_context,
        "forced_route": forced_route,
    }
    output = _GRAPH.invoke(state)
    return {
        "result": output.get("result", {}),
        "route": output.get("route", "planner"),
        "kpi_decision": output.get("kpi_decision", {}),
        "visualize_intent": output.get("visualize_intent", False),
        "entities": output.get("entities", {}),
    }
