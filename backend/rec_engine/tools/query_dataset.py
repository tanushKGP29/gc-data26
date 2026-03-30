"""
Stub dataset query tool for tests.
"""
import json
from typing import Dict, Any, List


def query_dataset(inputs: Dict[str, Any] = None) -> str:
    inputs = inputs or {}
    item_ids: List[str] = inputs.get("item_ids", ["item_001", "item_002"])
    items = []
    for item_id in item_ids:
        items.append({
            "item_id": item_id,
            "name": f"Product {item_id}",
            "category": "general",
            "price": 10.0,
            "margin_pct": 0.2,
            "inventory": 100,
            "avg_ctr": 0.05,
            "listed_days_ago": 10,
            "user_history_score": 0.7,
        })
    return json.dumps(items)

query_dataset.invoke = lambda inputs=None: query_dataset(inputs)
