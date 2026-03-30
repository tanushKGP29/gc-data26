"""
Stub model recommendation tool for tests.
"""
import json
from typing import Dict, Any


def get_model_recommendations(inputs: Dict[str, Any] = None) -> str:
    inputs = inputs or {}
    user_id = inputs.get("user_id", "user_000")
    top_n = int(inputs.get("top_n", 5))
    candidates = [
        {"item_id": f"item_{i:03d}", "similarity_score": 0.9 - i * 0.01}
        for i in range(min(top_n, 50))
    ]
    method = "popularity_fallback" if user_id == "user_999" else "hybrid"
    return json.dumps({
        "method": method,
        "candidates": candidates,
    })

get_model_recommendations.invoke = lambda inputs=None: get_model_recommendations(inputs)
