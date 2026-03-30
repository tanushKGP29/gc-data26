"""
Stub ReAct orchestrator to satisfy legacy tests.
"""
import asyncio
from typing import Dict, Any

async def run_agent(query: str, session_id: str = "") -> Dict[str, Any]:
    await asyncio.sleep(0)
    return {
        "response": f"(stub) No analytics executed. Received query: {query}",
        "artifacts": [],
        "suggestions": ["Try an analytics query", "Ask for a dataset summary"],
        "session_id": session_id or "stub-session",
    }
