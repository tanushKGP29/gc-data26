"""
DBMS Preset Functions - Standalone tools for data access

These functions are independent and can be called directly by:
- Planner (for simple queries)
- DBMS Agent (for complex retrieval)
- Code Executor (inside sandbox)

All functions work with the global DatasetRegistry.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
import json
import sys
from pathlib import Path

# Setup path for imports
_backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_backend_dir.parent))

from dataset_registry import get_registry


def _resolve_dataset_name(dataset_name: str, available: List[str]) -> Optional[str]:
    if dataset_name in available:
        return dataset_name

    if dataset_name.endswith("-chart"):
        alt = dataset_name.removesuffix("-chart")
        if alt in available:
            return alt

    alt = dataset_name.replace("-", "_")
    if alt in available:
        return alt

    # Simple token match fallback
    tokens = [t for t in dataset_name.replace("-", " ").split() if t]
    for name in available:
        if all(t.lower() in name.lower() for t in tokens):
            return name

    return None


def list_datasets() -> List[Dict[str, Any]]:
    """
    List all available datasets with metadata.
    
    Returns:
        List of dicts: [{name, row_count, col_count, columns}]
    """
    registry = get_registry()
    result = []
    
    for name, meta in registry.datasets.items():
        result.append({
            "name": name,
            "row_count": meta["rows"],
            "col_count": len(meta["columns"]),
            "columns": meta["columns"]
        })
    
    return result


def get_schema(dataset_name: str) -> List[Dict[str, Any]]:
    """
    Get detailed schema for a dataset.
    
    Args:
        dataset_name: Name of the dataset
        
    Returns:
        List of column info: [{col_name, dtype, sample_values, null_pct}]
    """
    registry = get_registry()
    resolved = _resolve_dataset_name(dataset_name, list(registry.datasets.keys()))
    meta = registry.datasets.get(resolved) if resolved else None
    
    if not meta:
        raise ValueError(f"Dataset '{dataset_name}' not found. Available: {list(registry.datasets.keys())}")
    
    # Load actual data to get accurate stats
    df = pd.read_csv(meta["path"], encoding="utf-8-sig")
    
    schema = []
    for col in df.columns:
        col_data = df[col]
        null_count = col_data.isnull().sum()
        null_pct = round((null_count / len(df)) * 100, 2) if len(df) > 0 else 0
        
        # Get sample values (non-null, unique)
        sample_vals = col_data.dropna().unique()[:5].tolist()
        
        schema.append({
            "col_name": col,
            "dtype": str(col_data.dtype),
            "sample_values": sample_vals,
            "null_pct": null_pct
        })
    
    return schema


def get_first_rows(dataset_name: str, n: int = 5) -> pd.DataFrame:
    """
    Get first n rows of a dataset.
    
    Args:
        dataset_name: Name of the dataset
        n: Number of rows (default 5)
        
    Returns:
        DataFrame with first n rows
    """
    registry = get_registry()
    resolved = _resolve_dataset_name(dataset_name, list(registry.datasets.keys()))
    meta = registry.datasets.get(resolved) if resolved else None
    
    if not meta:
        raise ValueError(f"Dataset '{dataset_name}' not found. Available: {list(registry.datasets.keys())}")
    
    df = pd.read_csv(meta["path"], nrows=n, encoding="utf-8-sig")
    return df


def get_stats(dataset_name: str, column: str) -> Dict[str, Any]:
    """
    Get statistics for a specific column.
    
    Args:
        dataset_name: Name of the dataset
        column: Column name
        
    Returns:
        Dict with stats: {min, max, mean, std, nulls, unique_count, dtype}
    """
    registry = get_registry()
    resolved = _resolve_dataset_name(dataset_name, list(registry.datasets.keys()))
    meta = registry.datasets.get(resolved) if resolved else None
    
    if not meta:
        raise ValueError(f"Dataset '{dataset_name}' not found. Available: {list(registry.datasets.keys())}")
    
    df = pd.read_csv(meta["path"], encoding="utf-8-sig")
    
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found in '{dataset_name}'. Available: {df.columns.tolist()}")
    
    col_data = df[column]
    stats = {
        "column": column,
        "dtype": str(col_data.dtype),
        "nulls": int(col_data.isnull().sum()),
        "unique_count": int(col_data.nunique())
    }
    
    # Numeric stats
    if pd.api.types.is_numeric_dtype(col_data):
        stats.update({
            "min": float(col_data.min()) if not pd.isna(col_data.min()) else None,
            "max": float(col_data.max()) if not pd.isna(col_data.max()) else None,
            "mean": float(col_data.mean()) if not pd.isna(col_data.mean()) else None,
            "std": float(col_data.std()) if not pd.isna(col_data.std()) else None,
        })
    else:
        # For non-numeric, show top values
        value_counts = col_data.value_counts().head(5).to_dict()
        stats["top_values"] = value_counts
    
    return stats


def get_full_dataset(dataset_name: str) -> pd.DataFrame:
    """
    Load and return the full dataset as DataFrame.
    
    Args:
        dataset_name: Name of the dataset
        
    Returns:
        Full DataFrame
    """
    registry = get_registry()
    resolved = _resolve_dataset_name(dataset_name, list(registry.datasets.keys()))
    meta = registry.datasets.get(resolved) if resolved else None
    
    if not meta:
        raise ValueError(f"Dataset '{dataset_name}' not found. Available: {list(registry.datasets.keys())}")
    
    return pd.read_csv(meta["path"], encoding="utf-8-sig")


def get_dataset_path(dataset_name: str) -> str:
    """
    Get the file path for a dataset.
    
    Args:
        dataset_name: Name of the dataset
        
    Returns:
        Absolute file path
    """
    registry = get_registry()
    resolved = _resolve_dataset_name(dataset_name, list(registry.datasets.keys()))
    meta = registry.datasets.get(resolved) if resolved else None
    
    if not meta:
        raise ValueError(f"Dataset '{dataset_name}' not found. Available: {list(registry.datasets.keys())}")
    
    return meta["path"]


# Utility function for LLM context
def get_datasets_context() -> str:
    """
    Get a formatted string of all datasets for LLM context.
    
    Returns:
        Formatted string with dataset info
    """
    datasets = list_datasets()
    
    context = "Available Datasets:\n\n"
    for ds in datasets:
        context += f"**{ds['name']}** ({ds['row_count']} rows)\n"
        context += f"  Columns: {', '.join(ds['columns'])}\n\n"
    
    return context
