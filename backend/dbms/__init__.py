"""
DBMS Subsystem - Preset Functions

Preset functions are standalone tools that can be called directly by:
- The Planner
- The Code Executor

These are independent data access functions.
"""

from .preset_functions import (
    list_datasets,
    get_schema,
    get_first_rows,
    get_stats,
    get_full_dataset,
    get_dataset_path,
    get_datasets_context,
)

__all__ = [
    "list_datasets",
    "get_schema", 
    "get_first_rows",
    "get_stats",
    "get_full_dataset",
    "get_dataset_path",
    "get_datasets_context",
]
