"""
Minimal tool router for tests.
"""
import json
from typing import Any, Dict

from dbms import list_datasets, get_schema, get_first_rows


def execute_tool(tool_name: str, **kwargs: Dict[str, Any]) -> str:
    if tool_name == "list_datasets":
        return json.dumps(list_datasets())
    if tool_name == "get_dataset_details":
        dataset_name = kwargs.get("dataset_name", "")
        schema = get_schema(dataset_name)
        first_rows = get_first_rows(dataset_name, 3).to_dict(orient="records")
        return json.dumps({"schema": schema, "sample_rows": first_rows})
    if tool_name == "search_columns":
        query = (kwargs.get("query", "") or "").lower()
        datasets = list_datasets()
        matches = []
        for ds in datasets:
            cols = [c for c in ds.get("columns", []) if query in c.lower()]
            if cols:
                matches.append({"dataset": ds.get("name"), "columns": cols})
        return json.dumps(matches)

    return json.dumps({"error": f"Unknown tool: {tool_name}"})
