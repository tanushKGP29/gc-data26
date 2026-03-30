"""
Stub recommendation orchestrator for tests.
"""
from typing import Any


def run_recommendation_agent(user_id: str, stream: bool = False) -> str:
    return f"Top 5 recommendations for {user_id}: item_001, item_002, item_003, item_004, item_005"
