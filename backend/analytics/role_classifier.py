"""
Role Classifier — LLM-based dataset role classification.

Classifies CSV files into dataset roles (channel_summary, monthly, etc.) by
examining actual column names and sample data, not just filenames.

Pipeline: cache check → pattern matching (fast path) → LLM classification (fallback)

Cache stores both successful AND "unclassified" results so supplementary files
(durations, flagged lists, raw video data) don't trigger repeated LLM calls.
"""
import json
import logging
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd

import sys
_backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_backend_dir.parent))

from llm.groq_client import fast_complete

logger = logging.getLogger("analytics.role_classifier")

CLASSIFICATIONS_CACHE_PATH = (
    Path(__file__).parent.parent.parent / "data" / "saved_analytics" / "role_classifications.json"
)


# ─── Cache ──────────────────────────────────────────────────────────────────

def load_cached_classifications() -> Dict[str, Dict]:
    """Load cached role classifications keyed by content hash."""
    if CLASSIFICATIONS_CACHE_PATH.exists():
        try:
            return json.loads(CLASSIFICATIONS_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Failed to load classification cache: {e}")
    return {}


def save_cached_classifications(cache: Dict[str, Dict]) -> None:
    """Persist classification cache to disk."""
    CLASSIFICATIONS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLASSIFICATIONS_CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def _compute_file_hash(path: Path) -> str:
    """SHA-256 of file content in 64KB chunks."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


# ─── LLM Classification ────────────────────────────────────────────────────

def _build_classification_prompt(
    columns: List[str],
    sample_rows: List[Dict[str, Any]],
    role_definitions: Dict[str, Dict],
) -> str:
    """Build LLM prompt with CSV metadata and all role definitions."""
    role_lines = []
    for i, (role_name, role_cfg) in enumerate(role_definitions.items(), 1):
        desc = role_cfg.get("description", role_name)
        sem_cols = role_cfg.get("semantic_columns", {})
        col_descs = ", ".join(
            f'{name} ({info.get("description", name)})'
            for name, info in sem_cols.items()
        )
        role_lines.append(f'{i}. "{role_name}": {desc}\n   Expected columns: {col_descs}')

    sample_text = ""
    for i, row in enumerate(sample_rows[:3], 1):
        sample_text += f"  Row {i}: {json.dumps(row, default=str)}\n"

    return f"""You must classify this CSV into one of the known roles, or say it does not match any.

CSV columns: {json.dumps(columns)}

Sample data:
{sample_text}
Known dataset roles:
{chr(10).join(role_lines)}

Instructions:
- Match based on column names, data types, and sample values
- A dataset matches a role if its columns correspond to that role's expected columns (names may differ but meaning should match)
- If the CSV does NOT match any role (e.g. it has completely different columns like durations, URLs, flags), return "unclassified"

You MUST respond with ONLY this JSON (no other text):
{{"role": "<role_name or unclassified>", "confidence": <0.0 to 1.0>}}"""


def _validate_role_columns(columns: List[str], role: str, registry_datasets: Dict[str, Dict]) -> bool:
    """Check that a CSV's columns have reasonable overlap with a role's semantic columns.
    Prevents misclassification of supplementary files (e.g. flagged_channels → channel_summary).
    Also checks identity_columns for disambiguation between similar roles."""
    role_cfg = registry_datasets.get(role, {})
    sem_cols = role_cfg.get("semantic_columns", {})
    if not sem_cols:
        return True  # No semantic columns defined, can't validate

    cols_lower = [c.strip().lower() for c in columns]

    # Identity column check: if the role defines identity_columns, at least one must be present
    identity_cols = role_cfg.get("identity_columns", [])
    if identity_cols:
        has_identity = any(ic.lower() in cols_lower for ic in identity_cols)
        if not has_identity:
            logger.debug(f"Identity column check failed for '{role}': need one of {identity_cols}, got {columns[:3]}")
            return False

    # Also reject if a DIFFERENT role's identity columns are present (cross-check)
    for other_role, other_cfg in registry_datasets.items():
        if other_role == role:
            continue
        other_identity = other_cfg.get("identity_columns", [])
        if not other_identity:
            continue
        # If the CSV has another role's identity column but NOT this role's, reject
        other_match = any(ic.lower() in cols_lower for ic in other_identity)
        this_match = any(ic.lower() in cols_lower for ic in identity_cols) if identity_cols else True
        if other_match and identity_cols and not this_match:
            logger.debug(f"Cross-role identity check: CSV has '{other_role}' identity columns, rejecting '{role}'")
            return False

    # Count how many semantic column descriptions loosely match actual columns
    expected_count = len(sem_cols)
    matched = 0
    for sem_name, sem_info in sem_cols.items():
        desc_words = sem_name.lower().replace("_", " ").split()
        # Check if any actual column contains the semantic name keywords
        for col in cols_lower:
            col_words = col.replace("_", " ").lower()
            if any(w in col_words for w in desc_words):
                matched += 1
                break

    # Require at least 50% of expected semantic columns to be present
    ratio = matched / expected_count if expected_count > 0 else 0
    if ratio < 0.5:
        logger.debug(f"Column validation failed: {matched}/{expected_count} semantic columns matched (ratio={ratio:.2f})")
        return False
    return True


def _classify_via_llm(
    csv_path: Path,
    registry_datasets: Dict[str, Dict],
) -> Optional[str]:
    """Call LLM to classify a CSV file into a dataset role.
    Returns role name or None."""
    try:
        df = pd.read_csv(csv_path, encoding="utf-8-sig", nrows=5)
    except Exception as e:
        logger.warning(f"[{csv_path.name}] Cannot read CSV: {e}")
        return None

    columns = list(df.columns)
    sample_rows = df.head(3).to_dict(orient="records")

    prompt = _build_classification_prompt(columns, sample_rows, registry_datasets)

    system_prompt = (
        "You are a data schema classification expert. "
        "Given a CSV's columns and sample data, classify it into one of the provided dataset roles. "
        "The CSV must have MOST of the expected columns for a role to match — a partial overlap (e.g. only 2 of 7 columns) means it does NOT match. "
        "If no role matches well, respond with unclassified. "
        "You MUST respond with ONLY valid JSON: {\"role\": \"...\", \"confidence\": 0.0}"
    )

    try:
        response = fast_complete(
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=256,
        )

        text = (response or "").strip()

        # Empty response = model couldn't classify
        if not text:
            logger.debug(f"[{csv_path.name}] LLM returned empty response — treating as unclassified")
            return None

        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
            text = text.strip()

        # Try to extract JSON from response (model sometimes adds text around it)
        if not text.startswith("{"):
            # Find first { and last }
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                text = text[start:end + 1]
            else:
                logger.debug(f"[{csv_path.name}] LLM response not JSON: {text[:100]}")
                return None

        result = json.loads(text)
        role = result.get("role", "unclassified")
        confidence = float(result.get("confidence", 0))

        if role == "unclassified" or confidence < 0.6:
            logger.debug(f"[{csv_path.name}] LLM → unclassified (role={role}, confidence={confidence:.2f})")
            return None

        if role not in registry_datasets:
            logger.warning(f"[{csv_path.name}] LLM returned unknown role '{role}'")
            return None

        # Validate that the CSV columns actually match the role's expected columns
        if not _validate_role_columns(columns, role, registry_datasets):
            logger.debug(f"[{csv_path.name}] LLM suggested '{role}' but column validation failed — treating as unclassified")
            return None

        logger.info(f"[{csv_path.name}] LLM classified → '{role}' (confidence: {confidence:.2f})")
        return role

    except json.JSONDecodeError as e:
        logger.debug(f"[{csv_path.name}] LLM response not valid JSON — treating as unclassified")
        return None
    except Exception as e:
        logger.warning(f"[{csv_path.name}] LLM classification error: {e}")
        return None


# ─── Main Entry Points ─────────────────────────────────────────────────────

def classify_dataset_role(
    csv_path: Path,
    registry_datasets: Dict[str, Dict],
    cache: Optional[Dict] = None,
) -> Optional[str]:
    """Classify a single CSV file into a dataset role.

    Strategy (ordered):
    1. Check cache by content hash (includes cached "unclassified" results)
    2. Try pattern matching (fast path, no LLM)
    3. Fall back to LLM classification

    Returns role name string, or None if unclassifiable.
    """
    from analytics.analytics_engine import resolve_dataset_role

    file_hash = _compute_file_hash(csv_path)

    # 1. Check cache (both classified AND unclassified results are cached)
    if cache is not None and file_hash in cache:
        cached = cache[file_hash]
        role = cached.get("role")
        if role:
            logger.debug(f"[{csv_path.name}] Cache hit → '{role}'")
        else:
            logger.debug(f"[{csv_path.name}] Cache hit → unclassified (skipping)")
        return role

    # 2. Fast path: pattern matching
    role = resolve_dataset_role(csv_path.name, registry_datasets)
    if role:
        logger.debug(f"[{csv_path.name}] Pattern match → '{role}'")
        if cache is not None:
            cache[file_hash] = {
                "role": role,
                "method": "pattern",
                "filename": csv_path.name,
                "classified_at": datetime.now().isoformat(),
            }
        return role

    # 3. LLM classification
    logger.info(f"[{csv_path.name}] No pattern match — classifying via LLM...")
    role = _classify_via_llm(csv_path, registry_datasets)

    # Cache the result (including None/unclassified so we don't re-call LLM)
    if cache is not None:
        cache[file_hash] = {
            "role": role,  # None for unclassified
            "method": "llm" if role else "unclassified",
            "filename": csv_path.name,
            "classified_at": datetime.now().isoformat(),
        }

    return role


def classify_all_datasets(
    data_dir: Path,
    registry_datasets: Dict[str, Dict],
) -> Dict[str, Any]:
    """Scan all CSVs in a directory and classify each into a role.

    Returns:
        {
            "classified": {filepath_str: role_name, ...},
            "unclassified": [filepath_str, ...]
        }
    """
    cache = load_cached_classifications()
    classified = {}
    unclassified = []

    for csv_path in sorted(data_dir.glob("*.csv")):
        role = classify_dataset_role(csv_path, registry_datasets, cache)
        if role:
            classified[str(csv_path)] = role
        else:
            unclassified.append(str(csv_path))

    save_cached_classifications(cache)

    logger.info(
        f"Classification complete: {len(classified)} classified, "
        f"{len(unclassified)} unclassified"
    )
    return {"classified": classified, "unclassified": unclassified}
