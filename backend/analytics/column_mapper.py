"""
Column Mapper Agent — LLM-based mapping of semantic column names to actual CSV columns.
Runs only on schema changes. No similarity matching — always uses LLM.
"""
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import pandas as pd

import sys
_backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_backend_dir.parent))

from llm.groq_client import fast_complete

logger = logging.getLogger("analytics.column_mapper")

MAPPINGS_PATH = Path(__file__).parent.parent.parent / "data" / "saved_analytics" / "column_mappings.json"


def load_persisted_mappings() -> Dict:
    """Load existing column mappings from disk."""
    if MAPPINGS_PATH.exists():
        try:
            return json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Failed to load column mappings: {e}")
    return {}


def save_mappings(mappings: Dict) -> None:
    """Persist column mappings to disk."""
    MAPPINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAPPINGS_PATH.write_text(json.dumps(mappings, indent=2), encoding="utf-8")
    logger.info(f"Saved column mappings to {MAPPINGS_PATH}")


def _build_llm_prompt(
    dataset_role: str,
    semantic_requirements: List[Dict],
    candidate_columns: List[Dict]
) -> str:
    """Build the LLM prompt for column mapping."""
    sem_lines = []
    for req in semantic_requirements:
        sem_lines.append(f'- "{req["name"]}"    ({req["description"]})')

    col_lines = []
    for i, col in enumerate(candidate_columns, 1):
        samples_str = str(col["samples"][:3]) if col.get("samples") else "[]"
        col_lines.append(f'{i}. "{col["name"]}"    dtype={col["dtype"]}  samples={samples_str}')

    return f"""Dataset role: {dataset_role}

Semantic names to map:
{chr(10).join(sem_lines)}

Actual columns in this dataset:
{chr(10).join(col_lines)}

Return a JSON object mapping each semantic name to the best matching actual column name.
Use null if no reasonable match exists.
Example: {{"uploaded_count": "Uploaded Count", "channel_name": "Channel"}}

Return ONLY valid JSON, no commentary."""


def map_columns_for_dataset(
    dataset_role: str,
    df: pd.DataFrame,
    semantic_columns: Dict[str, Dict],
) -> Dict[str, str]:
    """
    Map semantic column names to actual column names using LLM.
    One LLM call per dataset, all semantics batched.
    """
    # Build candidate column info
    candidates = []
    for col in df.columns:
        samples = []
        try:
            samples = df[col].dropna().head(3).tolist()
            samples = [str(s) for s in samples]
        except Exception:
            pass
        candidates.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "samples": samples
        })

    # Build semantic requirements
    requirements = []
    for sem_name, sem_info in semantic_columns.items():
        requirements.append({
            "name": sem_name,
            "description": sem_info.get("description", sem_name)
        })

    prompt = _build_llm_prompt(dataset_role, requirements, candidates)

    system_prompt = """You are a data schema mapping expert for a media analytics platform called Frammer.
Map semantic column names to actual CSV column names. Return ONLY valid JSON.

Domain knowledge:
- "uploaded_count" = column counting source videos uploaded by users
- "created_count" = column counting AI-processed/created clips (may also be called "outputs" or "processed")
- "published_count" = column counting clips published to social platforms
- "uploaded_duration" / "created_duration" / "published_duration" = columns with time in hh:mm:ss format
- "channel_name" = channel/team identifier (often a single letter or short name)
- "user_name" = individual user or operator identifier
- "month_label" = month identifier (e.g., "Mar", "Apr, 2025", "2025-03")
- Platform columns (facebook_count, youtube_count, etc.) = count of publishes to that platform
- "output_type_name" / "input_type_name" / "language_name" = the categorical grouping column
- Use null for semantic names with no reasonable match."""

    try:
        response = fast_complete(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=1024
        )

        # Parse JSON from response (handle markdown code blocks)
        text = response.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
            text = text.strip()

        mapping = json.loads(text)

        # Validate: all mapped columns must exist in df
        validated = {}
        for sem_name, actual_col in mapping.items():
            if actual_col is None:
                logger.warning(f"[{dataset_role}] No match for semantic '{sem_name}'")
                continue
            if actual_col in df.columns:
                validated[sem_name] = actual_col
            else:
                logger.warning(f"[{dataset_role}] LLM mapped '{sem_name}' -> '{actual_col}' but column not found in dataset")

        logger.info(f"[{dataset_role}] Mapped {len(validated)}/{len(semantic_columns)} semantic columns")
        return validated

    except Exception as e:
        logger.error(f"[{dataset_role}] Column mapping failed: {e}")
        return {}


def run_column_mapper(
    role_to_df: Dict[str, pd.DataFrame],
    registry_datasets: Dict[str, Dict],
    existing_mappings: Optional[Dict] = None,
    changed_roles: Optional[List[str]] = None
) -> Dict[str, Dict[str, str]]:
    """
    Top-level entry point. Maps columns for changed datasets, reuses existing for unchanged.

    Args:
        role_to_df: {role: DataFrame} for datasets to potentially map
        registry_datasets: dataset definitions from analytics_registry.json
        existing_mappings: previously saved mappings
        changed_roles: if provided, only re-map these roles

    Returns:
        Complete mappings dict (all roles)
    """
    existing = dict(existing_mappings or {})
    roles_to_map = changed_roles or list(role_to_df.keys())

    for role in roles_to_map:
        if role.startswith("_"):
            continue
        if role not in role_to_df:
            continue
        if role not in registry_datasets:
            logger.warning(f"Role '{role}' not found in registry, skipping")
            continue

        df = role_to_df[role]
        semantic_columns = registry_datasets[role].get("semantic_columns", {})

        if not semantic_columns:
            continue

        logger.info(f"Mapping columns for dataset role: {role}")
        mapping = map_columns_for_dataset(role, df, semantic_columns)
        if mapping:
            # Merge with existing to preserve mappings for columns not in current DF
            merged = dict(existing.get(role, {}))
            merged.update(mapping)
            existing[role] = merged
        else:
            logger.info(f"[{role}] LLM mapping returned empty, keeping existing mapping")

        # Ensure all registry semantic columns have a mapping entry
        role_mapping = existing.get(role, {})
        for sem_name in semantic_columns:
            if sem_name not in role_mapping:
                role_mapping[sem_name] = sem_name  # identity fallback
        existing[role] = role_mapping

    # Add metadata
    existing["_meta"] = {
        "generated_at": datetime.now().isoformat(),
        "roles_mapped": roles_to_map
    }

    save_mappings(existing)
    return existing
