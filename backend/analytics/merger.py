"""
CSV Data Merger Agent
=====================
Run with:
    pip install groq
    set GROQ_API_KEY=your_key_here          # Windows
    export GROQ_API_KEY=your_key_here       # Mac/Linux
    python run.py

Or pass key directly:
    python run.py --api-key YOUR_KEY_HERE

Usage:
    # Step 1 — load baseline CSV into DB
    python run.py --baseline baseline_2025_Q4.csv

    # Step 2 — merge new CSV into existing DB
    python run.py --incoming incoming_2026_Q1.csv

    # Step 3 — export merged result
    python run.py --export merged_output.csv

    # Full pipeline in one command
    python run.py --baseline baseline_2025_Q4.csv --incoming incoming_2026_Q1.csv --export merged_output.csv

    # Merge multiple dataset CSVs per role (e.g. channel_platform1.csv + channel_platform2.csv)
    python run.py --merge-datasets
"""

import sqlite3, csv, json, os, sys, argparse, re
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd

# ── colours ───────────────────────────────────────────────────────────────────
R="\033[0m"; B="\033[1m"; DIM="\033[2m"
GR="\033[32m"; YL="\033[33m"; CY="\033[36m"; RD="\033[31m"; WH="\033[37m"; BL="\033[34m"
def c(col, t): return f"{col}{t}{R}"

# ── paths ─────────────────────────────────────────────────────────────────────
# merger.py lives at backend/analytics/ — navigate up to project root (gc26)
_PROJECT_ROOT      = Path(__file__).parent.parent.parent
DATASETS_DIR       = _PROJECT_ROOT / "data" / "datasets"
MERGED_DIR         = _PROJECT_ROOT / "data" / "merged"
REGISTRY_PATH      = Path(__file__).parent / "analytics_registry.json"
DATASET_PATHS_JSON = _PROJECT_ROOT / "data" / "saved_analytics" / "dataset_paths.json"

# ── column mapping integration (from column_mapper.py) ────────────────────────
MAPPINGS_PATH = _PROJECT_ROOT / "data" / "saved_analytics" / "column_mappings.json"

# Defaults matching the original hardcoded column names
DEFAULT_COL_MAP = {
    "user_name":          "User",
    "uploaded_count":     "Uploaded Count",
    "created_count":      "Created Count",
    "published_count":    "Published Count",
    "uploaded_duration":  "Uploaded Duration (hh:mm:ss)",
    "created_duration":   "Created Duration (hh:mm:ss)",
    "published_duration": "Published Duration (hh:mm:ss)",
}

def load_column_mappings():
    """Load column mappings produced by column_mapper.py.
    Tries user_summary first (has user_name + all counts/durations),
    then channel_summary as fallback, merging both if needed.
    Returns a semantic→actual column name dict."""
    if not MAPPINGS_PATH.exists():
        return dict(DEFAULT_COL_MAP)
    try:
        all_mappings = json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return dict(DEFAULT_COL_MAP)

    # Start from defaults, overlay with persisted mappings
    col_map = dict(DEFAULT_COL_MAP)

    # user_summary has user_name + counts + durations
    us = all_mappings.get("user_summary", {})
    for key in col_map:
        if key in us:
            col_map[key] = us[key]

    # channel_summary may have counts/durations too — fill any gaps
    cs = all_mappings.get("channel_summary", {})
    for key in col_map:
        if col_map[key] == DEFAULT_COL_MAP.get(key) and key in cs:
            col_map[key] = cs[key]

    return col_map

def load_all_column_mappings():
    """Load the full column_mappings.json as-is (all roles)."""
    if MAPPINGS_PATH.exists():
        try:
            return json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

# ── analytics registry helpers ────────────────────────────────────────────────

def load_analytics_registry():
    """Load analytics_registry.json for dataset role definitions."""
    if REGISTRY_PATH.exists():
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return {}


def update_column_mappings_to_identity(roles: list, registry_datasets: dict) -> dict:
    """After normalization, update column_mappings.json so semantic→semantic (identity mapping).
    
    This ensures KPI executor can find columns by semantic names in the normalized CSVs.
    
    Args:
        roles: List of roles that were normalized
        registry_datasets: Dataset definitions from analytics_registry.json
        
    Returns:
        Updated column_mappings dict
    """
    import logging
    from datetime import datetime
    log = logging.getLogger("analytics.merger")
    
    # Load existing mappings
    existing = {}
    if MAPPINGS_PATH.exists():
        try:
            existing = json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    
    # Update mappings for normalized roles to identity
    for role in roles:
        role_cfg = registry_datasets.get(role, {})
        semantic_columns = role_cfg.get("semantic_columns", {})
        
        # Create identity mapping: semantic_name -> semantic_name
        identity_map = {sem_name: sem_name for sem_name in semantic_columns.keys()}
        existing[role] = identity_map
        log.info(f"Updated column mapping for '{role}' to identity: {list(identity_map.keys())}")
    
    # Update metadata
    existing["_meta"] = {
        "generated_at": datetime.now().isoformat(),
        "roles_mapped": list(existing.keys()),
        "normalized": True
    }
    
    # Save
    MAPPINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAPPINGS_PATH.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    log.info(f"Saved identity column mappings to {MAPPINGS_PATH}")
    
    return existing

def resolve_dataset_role(filename, registry_datasets):
    """Map a CSV filename to its logical DATASET_PATHS role.
    Uses analytics_registry patterns first, then falls back to role-key matching."""
    filename_lower = filename.lower()
    best_role = None
    best_score = -1

    # 1. Try analytics_registry pattern matching (supports filename_patterns_any OR groups)
    for role, cfg in registry_datasets.items():
        excludes = cfg.get("filename_excludes", [])
        if any(e.lower() in filename_lower for e in excludes):
            continue

        patterns_any = cfg.get("filename_patterns_any", [])
        patterns = cfg.get("filename_patterns", [])

        matched_patterns = None
        if patterns_any:
            for group in patterns_any:
                if all(p.lower() in filename_lower for p in group):
                    score = sum(len(p) for p in group)
                    if matched_patterns is None or score > sum(len(p) for p in matched_patterns):
                        matched_patterns = group
        elif patterns:
            if all(p.lower() in filename_lower for p in patterns):
                matched_patterns = patterns

        if matched_patterns is not None:
            score = sum(len(p) for p in matched_patterns)
            if score > best_score:
                best_score = score
                best_role = role

    if best_role:
        return best_role

    # 2. Fallback: match by role key name (e.g. "channel_platform1.csv" -> "channel_platform")
    stem_lower = re.sub(r'[\d_]+$', '', Path(filename).stem.lower())  # strip trailing digits/underscores
    for role_key in registry_datasets:
        if stem_lower == role_key:
            return role_key

    return None


def find_merge_candidates(registry_datasets):
    """Scan DATASETS_DIR, group CSV files by their dataset role.
    Uses pattern matching first, then LLM classification for unmatched.
    Returns {role: [Path, ...]} and list of unmatched files."""
    groups = {}
    unmatched = []

    for csv_path in sorted(DATASETS_DIR.glob("*.csv")):
        role = resolve_dataset_role(csv_path.name, registry_datasets)
        if role:
            groups.setdefault(role, []).append(csv_path)
        else:
            unmatched.append(csv_path)

    # Try LLM classification for unmatched files
    if unmatched:
        try:
            from analytics.role_classifier import classify_dataset_role as llm_classify, load_cached_classifications
            cache = load_cached_classifications()
            still_unmatched = []
            for csv_path in unmatched:
                role = llm_classify(csv_path, registry_datasets, cache)
                if role:
                    groups.setdefault(role, []).append(csv_path)
                else:
                    still_unmatched.append(csv_path)
            unmatched = still_unmatched
        except Exception as e:
            import logging
            logging.getLogger("analytics.merger").warning(f"LLM classification fallback failed: {e}")

    return groups, unmatched


def get_role_column_info(role, registry_datasets, all_col_mappings=None):
    """Get key/sum/duration columns for a role from registry.
    Returns (key_cols, sum_cols, dur_cols) using SEMANTIC column names (canonical).
    
    After normalization, all DataFrames use semantic names, so we return those directly.
    """
    role_cfg = registry_datasets.get(role, {})
    sem_cols = role_cfg.get("semantic_columns", {})

    key_cols = []
    sum_cols = []
    dur_cols = []

    for sem_name, sem_info in sem_cols.items():
        dtype = sem_info.get("dtype_hint", "")
        if dtype == "categorical":
            key_cols.append(sem_name)
        elif dtype == "integer":
            sum_cols.append(sem_name)
        elif dtype == "duration":
            dur_cols.append(sem_name)

    return key_cols, sum_cols, dur_cols


def get_or_create_file_mapping(filepath: Path, role: str, registry_datasets: dict, existing_mappings: dict) -> dict:
    """Get column mapping for a specific file, creating via LLM if needed.
    
    Returns a dict mapping semantic_name -> actual_column_name for this file.
    """
    import logging
    log = logging.getLogger("analytics.merger")
    
    # Check if we already have a mapping for this role that works for this file
    role_mapping = existing_mappings.get(role, {})
    
    try:
        df = pd.read_csv(filepath, encoding="utf-8-sig", nrows=5)
        file_columns = set(df.columns)
    except Exception as e:
        log.warning(f"Failed to read {filepath.name} for mapping: {e}")
        return role_mapping
    
    # Check if existing mapping covers this file's columns
    if role_mapping:
        mapped_actuals = set(v for v in role_mapping.values() if v)
        if mapped_actuals.issubset(file_columns) and len(mapped_actuals) > 0:
            return role_mapping
    
    # Need to create mapping for this file via LLM
    role_cfg = registry_datasets.get(role, {})
    semantic_columns = role_cfg.get("semantic_columns", {})
    
    if not semantic_columns:
        return {}
    
    try:
        from analytics.column_mapper import map_columns_for_dataset
        df_full = pd.read_csv(filepath, encoding="utf-8-sig")
        file_mapping = map_columns_for_dataset(role, df_full, semantic_columns)
        log.info(f"Created column mapping for {filepath.name} -> {role}: {file_mapping}")
        return file_mapping if file_mapping else role_mapping
    except Exception as e:
        log.warning(f"LLM column mapping failed for {filepath.name}: {e}")
        return role_mapping


def normalize_dataframe_columns(df: pd.DataFrame, role: str, registry_datasets: dict, 
                                 existing_mappings: dict, filepath: Path = None) -> pd.DataFrame:
    """Normalize DataFrame columns from actual names to semantic names.
    
    Example: 'Uploaded video count' -> 'uploaded_count'
    
    This ensures all DataFrames for the same role have identical column names before merge.
    """
    import logging
    log = logging.getLogger("analytics.merger")
    
    # Get mapping for this file (actual -> semantic is the reverse of stored mapping)
    if filepath:
        file_mapping = get_or_create_file_mapping(filepath, role, registry_datasets, existing_mappings)
    else:
        file_mapping = existing_mappings.get(role, {})
    
    if not file_mapping:
        log.warning(f"No column mapping for role '{role}', columns unchanged")
        return df
    
    # Build reverse mapping: actual_column -> semantic_name
    actual_to_semantic = {v: k for k, v in file_mapping.items() if v}
    
    # Rename columns that have mappings
    rename_map = {}
    for col in df.columns:
        if col in actual_to_semantic:
            rename_map[col] = actual_to_semantic[col]
    
    if rename_map:
        df = df.rename(columns=rename_map)
        log.debug(f"Normalized columns: {rename_map}")
    
    return df


def split_extra_columns(dfs, role, registry_datasets, column_mappings):
    """Split DataFrames into core (role-defined) and extra columns.

    Core columns are those defined in the role's semantic_columns.
    Extra columns are everything else — they always include key cols for join capability.
    
    NOTE: Assumes DataFrames are already normalized to semantic column names.

    Returns (core_dfs, extra_dfs) where extra_dfs may be empty.
    """
    import logging
    log = logging.getLogger("analytics.merger")

    key_cols, sum_cols, dur_cols = get_role_column_info(role, registry_datasets, column_mappings)
    known_cols = set(key_cols + sum_cols + dur_cols)

    core_dfs, extra_dfs = [], []
    for df in dfs:
        extra_cols = [c for c in df.columns if c not in known_cols]
        if extra_cols:
            key_present = [k for k in key_cols if k in df.columns]
            extra_dfs.append(df[key_present + extra_cols].copy())
            # Only include in core if it has non-key data columns (not just keys)
            core_cols = [c for c in df.columns if c not in extra_cols]
            non_key_core = [c for c in core_cols if c not in key_cols]
            if non_key_core:
                core_dfs.append(df[core_cols].copy())
            else:
                log.info(f"[{role}] File has only extra columns + keys, skipping from core merge")
            log.info(f"[{role}] Split {len(extra_cols)} extra columns: {extra_cols[:5]}")
        else:
            core_dfs.append(df)
    return core_dfs, extra_dfs


def merge_supplement_dataframes(extra_dfs, key_cols):
    """Merge supplement DataFrames with heuristic type detection.

    Duration columns (HH:MM:SS values) are summed via dur2s/s2dur.
    Numeric columns are summed.
    Other columns use 'first' aggregation.
    Groups by key_cols present in the supplement.
    """
    if not extra_dfs:
        return None

    combined = pd.concat(extra_dfs, ignore_index=True)
    existing_keys = [k for k in key_cols if k in combined.columns]

    if not existing_keys:
        return combined.drop_duplicates().reset_index(drop=True)

    # Heuristic type detection for non-key columns
    agg_dict = {}
    dur_secs_map = {}
    for col in combined.columns:
        if col in existing_keys:
            continue
        # Check if duration column (HH:MM:SS pattern)
        sample = combined[col].dropna().head(10)
        is_duration = False
        if len(sample) > 0 and sample.dtype == object:
            import re as _re
            is_duration = all(_re.match(r'^\d+:\d{2}:\d{2}$', str(v).strip()) for v in sample if str(v).strip())

        if is_duration:
            secs_col = f"__{col}__secs"
            combined[secs_col] = combined[col].apply(lambda x: dur2s(str(x)))
            dur_secs_map[col] = secs_col
            agg_dict[secs_col] = "sum"
        elif pd.api.types.is_numeric_dtype(combined[col]):
            agg_dict[col] = "sum"
        else:
            # Try to coerce to numeric
            numeric_col = pd.to_numeric(combined[col], errors="coerce")
            if numeric_col.notna().sum() > 0 and numeric_col.notna().sum() == combined[col].notna().sum():
                combined[col] = numeric_col
                agg_dict[col] = "sum"
            else:
                agg_dict[col] = "first"

    if not agg_dict:
        return combined.drop_duplicates(subset=existing_keys).reset_index(drop=True)

    merged = combined.groupby(existing_keys, as_index=False).agg(agg_dict)

    # Convert duration seconds back to hh:mm:ss
    for orig_col, secs_col in dur_secs_map.items():
        if secs_col in merged.columns:
            merged[orig_col] = merged[secs_col].apply(lambda t: s2dur(int(t)))
            merged.drop(columns=[secs_col], inplace=True)

    return merged


def smart_merge_dataframes(dfs, key_cols, sum_cols, dur_cols):
    """Merge multiple DataFrames: group by key_cols, sum integers, sum durations."""
    if len(dfs) == 1:
        return dfs[0]

    combined = pd.concat(dfs, ignore_index=True)

    # If no key columns exist in the data, return simple concat (deduplicated)
    existing_keys = [k for k in key_cols if k in combined.columns]
    if not existing_keys:
        return combined.drop_duplicates().reset_index(drop=True)

    # Convert integer columns to numeric
    for col in sum_cols:
        if col in combined.columns:
            combined[col] = pd.to_numeric(combined[col], errors="coerce").fillna(0).astype(int)

    # Convert duration columns to seconds for summing
    dur_secs_map = {}  # original_col -> temp_secs_col
    for col in dur_cols:
        if col in combined.columns:
            secs_col = f"__{col}__secs"
            combined[secs_col] = combined[col].apply(lambda x: dur2s(str(x)))
            dur_secs_map[col] = secs_col

    # Build aggregation dict
    agg_dict = {}
    for col in sum_cols:
        if col in combined.columns:
            agg_dict[col] = "sum"
    for orig, secs in dur_secs_map.items():
        agg_dict[secs] = "sum"
    # Other columns: take first value (log warning — these may lose data)
    first_cols = [col for col in combined.columns
                  if col not in existing_keys and col not in agg_dict]
    if first_cols:
        import logging
        logging.getLogger("analytics.merger").warning(
            f"Columns using 'first' aggregation (potential data loss): {first_cols}"
        )
    for col in first_cols:
        agg_dict[col] = "first"

    if not agg_dict:
        return combined.drop_duplicates(subset=existing_keys).reset_index(drop=True)

    merged = combined.groupby(existing_keys, as_index=False).agg(agg_dict)

    # Convert duration seconds back to hh:mm:ss
    for orig_col, secs_col in dur_secs_map.items():
        if secs_col in merged.columns:
            merged[orig_col] = merged[secs_col].apply(lambda t: s2dur(int(t)))
            merged.drop(columns=[secs_col], inplace=True)

    return merged


def merge_all_datasets():
    """Main orchestrator for --merge-datasets mode.
    Scans DATASETS_DIR, groups files by role, merges, saves as {role}.csv in MERGED_DIR.
    Normalizes all columns to semantic names before merging."""
    registry = load_analytics_registry()
    registry_datasets = registry.get("datasets", {})
    all_col_maps = load_all_column_mappings()

    if not registry_datasets:
        print(f"  {c(RD,'!')} analytics_registry.json not found or empty")
        return {}

    groups, unmatched = find_merge_candidates(registry_datasets)

    if not groups:
        print(f"  {c(YL,'!')} No CSV files found in {c(DIM, str(DATASETS_DIR))}")
        return {}

    MERGED_DIR.mkdir(parents=True, exist_ok=True)

    # Bug 3 fix: load existing paths first, don't overwrite blindly
    existing_paths = {}
    if DATASET_PATHS_JSON.exists():
        try:
            existing_paths = json.loads(DATASET_PATHS_JSON.read_text(encoding="utf-8"))
        except Exception:
            existing_paths = {}
    dataset_paths = dict(existing_paths)
    merge_summary = []

    for role in sorted(groups.keys()):
        files = groups[role]
        key_cols, sum_cols, dur_cols = get_role_column_info(role, registry_datasets, all_col_maps)

        print(f"\n  {c(B, role.upper())} ({len(files)} file(s))")
        for f in files:
            print(f"    {c(DIM, f.name)}")

        # Load all DataFrames and normalize columns to semantic names
        dfs = []
        for f in files:
            try:
                df = pd.read_csv(f, encoding="utf-8-sig")
                # Normalize columns to semantic names
                df = normalize_dataframe_columns(df, role, registry_datasets, all_col_maps, filepath=f)
                dfs.append(df)
                print(f"    {c(DIM, '  -> normalized columns:')} {list(df.columns)[:5]}...")
            except Exception as e:
                print(f"    {c(RD,'!')} Failed to read {f.name}: {e}")
        if not dfs:
            continue

        # Merge all columns — no supplement splitting, everything stays in core file
        if len(dfs) == 1:
            merged_core = dfs[0]
            output_path = MERGED_DIR / f"{role}.csv"
            merged_core.to_csv(output_path, index=False, encoding="utf-8-sig")
            dataset_paths[role] = str(output_path)
            merge_summary.append({"role": role, "files": 1, "action": "normalized", "output": f"{role}.csv", "rows": len(merged_core)})
            print(f"    {c(GR,'+')} Normalized -> {c(WH, f'{role}.csv')} ({len(merged_core)} rows)")
        else:
            merged_core = smart_merge_dataframes(dfs, key_cols, sum_cols, dur_cols)
            output_name = f"{role}.csv"
            output_path = MERGED_DIR / output_name
            merged_core.to_csv(output_path, index=False, encoding="utf-8-sig")
            dataset_paths[role] = str(output_path)
            merge_summary.append({"role": role, "files": len(files), "action": "merged", "output": output_name, "rows": len(merged_core)})
            print(f"    {c(GR,'+')} Merged {len(files)} files -> {c(WH, output_name)} ({len(merged_core)} rows)")

    # Handle unmatched files
    if unmatched:
        print(f"\n  {c(YL,'UNMATCHED FILES')} (not matching any known role):")
        for f in unmatched:
            print(f"    {c(DIM, f.name)}")

    # Prune dead entries (files that no longer exist)
    dataset_paths = {k: v for k, v in dataset_paths.items() if Path(v).exists()}

    # Save updated DATASET_PATHS
    DATASET_PATHS_JSON.parent.mkdir(parents=True, exist_ok=True)
    DATASET_PATHS_JSON.write_text(json.dumps(dataset_paths, indent=4), encoding="utf-8")
    print(f"\n  {c(GR,'+')} DATASET_PATHS saved to {c(DIM, str(DATASET_PATHS_JSON))}")

    return dataset_paths


def merge_datasets_for_pipeline(
    registry_datasets: dict,
    column_mappings: dict,
    dataset_paths: dict,
) -> dict:
    """Pipeline entry point: merge multi-file datasets, called by analytics_engine.

    Unlike merge_all_datasets() (CLI), this:
    - Accepts pre-resolved args from the engine (no disk I/O for registry/mappings)
    - Uses logging instead of print()
    - Normalizes all columns to semantic names before merging
    - Returns updated dataset_paths dict

    Args:
        registry_datasets: dataset definitions from analytics_registry.json
        column_mappings:   column mappings from column_mapper
        dataset_paths:     current {role: filepath} from analytics_engine

    Returns:
        Updated dataset_paths dict (roles with merged files point to new {role}.csv)
    """
    import logging
    log = logging.getLogger("analytics.merger")

    groups, unmatched = find_merge_candidates(registry_datasets)

    # Bug 2 fix: overlay dataset_paths into scanned groups so tracked files aren't lost
    for role, path_str in dataset_paths.items():
        if role.endswith("_supplement"):
            continue  # supplements handled separately
        p = Path(path_str)
        if p.exists() and p.suffix.lower() == ".csv":
            existing_in_group = {str(f) for f in groups.get(role, [])}
            if str(p) not in existing_in_group:
                groups.setdefault(role, []).append(p)

    if not groups:
        log.info("Merger: no CSV files found in datasets dir")
        return dict(dataset_paths)

    MERGED_DIR.mkdir(parents=True, exist_ok=True)
    updated_paths = dict(dataset_paths)
    merged_roles = []

    for role in sorted(groups.keys()):
        files = groups[role]

        # Load all DataFrames and normalize columns to semantic names
        dfs = []
        for f in files:
            try:
                df = pd.read_csv(f, encoding="utf-8-sig")
                # Normalize columns to semantic names (e.g., 'Uploaded Count' -> 'uploaded_count')
                df = normalize_dataframe_columns(df, role, registry_datasets, column_mappings, filepath=f)
                dfs.append(df)
                log.debug(f"Loaded and normalized {f.name}: columns={list(df.columns)}")
            except Exception as e:
                log.warning(f"Merger: failed to read {f.name}: {e}")
        if not dfs:
            continue

        key_cols, sum_cols, dur_cols = get_role_column_info(role, registry_datasets, column_mappings)

        # Merge all columns — no supplement splitting, everything stays in core file
        if len(dfs) == 1:
            output_path = MERGED_DIR / f"{role}.csv"
            dfs[0].to_csv(output_path, index=False, encoding="utf-8-sig")
            updated_paths[role] = str(output_path)
            log.info(f"Merger: normalized '{role}' -> {role}.csv ({len(dfs[0])} rows)")
        else:
            merged_core = smart_merge_dataframes(dfs, key_cols, sum_cols, dur_cols)
            output_name = f"{role}.csv"
            output_path = MERGED_DIR / output_name
            merged_core.to_csv(output_path, index=False, encoding="utf-8-sig")
            updated_paths[role] = str(output_path)
            merged_roles.append(role)
            log.info(f"Merger: merged {len(files)} files for '{role}' -> {output_name} ({len(merged_core)} rows)")

    if unmatched:
        log.info(f"Merger: {len(unmatched)} unmatched file(s) skipped")

    # Prune dead entries
    updated_paths = {k: v for k, v in updated_paths.items() if Path(v).exists()}

    # Persist updated paths
    DATASET_PATHS_JSON.parent.mkdir(parents=True, exist_ok=True)
    DATASET_PATHS_JSON.write_text(json.dumps(updated_paths, indent=4), encoding="utf-8")

    if merged_roles:
        log.info(f"Merger: merged roles={merged_roles}, saved dataset_paths.json")
    else:
        log.info("Merger: no multi-file roles found, nothing merged")

    # Return column_mappings as-is (raw→semantic) — KPI executor uses semantic names directly
    from analytics.column_mapper import load_persisted_mappings
    current_mappings = load_persisted_mappings()
    return updated_paths, current_mappings


# ── db helpers ─────────────────────────────────────────────────────────────────
DB_PATH = "merger.db"

def get_conn():
    cx = sqlite3.connect(DB_PATH); cx.row_factory = sqlite3.Row; return cx

def dur2s(d):
    try: h,m,s = map(int, d.strip().split(":")); return h*3600+m*60+s
    except: return 0

def s2dur(t):
    h=t//3600; m=(t%3600)//60; s=t%60; return f"{h:02d}:{m:02d}:{s:02d}"

def norm(n): return n.strip().lower()
def now_ts(): return datetime.now(timezone.utc).isoformat()


def load_env_file(env_path=Path(".env")):
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

def init_db():
    cx = get_conn()
    cx.execute("""CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT UNIQUE NOT NULL,
        user_name TEXT NOT NULL,
        uploaded_count INT DEFAULT 0,
        created_count INT DEFAULT 0,
        published_count INT DEFAULT 0,
        uploaded_secs INT DEFAULT 0,
        created_secs INT DEFAULT 0,
        published_secs INT DEFAULT 0,
        source_files TEXT DEFAULT '[]',
        created_at TEXT, updated_at TEXT)""")
    cx.execute("""CREATE TABLE IF NOT EXISTS merge_log(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT, user_id INT, user_name TEXT,
        detail TEXT, merged_at TEXT)""")
    cx.commit(); cx.close()

def row_to_dict(row):
    d = dict(row)
    d["uploaded_duration"]  = s2dur(d["uploaded_secs"])
    d["created_duration"]   = s2dur(d["created_secs"])
    d["published_duration"] = s2dur(d["published_secs"])
    return d

def db_lookup(name):
    cx = get_conn(); key = norm(name)
    row = cx.execute("SELECT * FROM users WHERE user_key=?", (key,)).fetchone()
    if not row:
        row = cx.execute("SELECT * FROM users WHERE user_key LIKE ?", (f"%{key}%",)).fetchone()
    cx.close()
    return row_to_dict(row) if row else None

def db_insert(data, source):
    cx = get_conn(); cur = cx.cursor()
    cur.execute("""INSERT OR IGNORE INTO users
        (user_key,user_name,uploaded_count,created_count,published_count,
         uploaded_secs,created_secs,published_secs,source_files,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
        (norm(data["user_name"]), data["user_name"],
         data.get("uploaded_count",0), data.get("created_count",0), data.get("published_count",0),
         dur2s(data.get("uploaded_duration","00:00:00")),
         dur2s(data.get("created_duration","00:00:00")),
         dur2s(data.get("published_duration","00:00:00")),
         json.dumps([source]), now_ts(), now_ts()))
    uid = cur.lastrowid; cx.commit(); cx.close()
    return uid

def db_update(uid, inc, source):
    cx = get_conn()
    ex = dict(cx.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    srcs = json.loads(ex["source_files"] or "[]")
    if source not in srcs: srcs.append(source)
    cx.execute("""UPDATE users SET
        uploaded_count=?,created_count=?,published_count=?,
        uploaded_secs=?,created_secs=?,published_secs=?,
        source_files=?,updated_at=? WHERE id=?""",
        (ex["uploaded_count"]  + inc.get("uploaded_count",0),
         ex["created_count"]   + inc.get("created_count",0),
         ex["published_count"] + inc.get("published_count",0),
         ex["uploaded_secs"]   + dur2s(inc.get("uploaded_duration","00:00:00")),
         ex["created_secs"]    + dur2s(inc.get("created_duration","00:00:00")),
         ex["published_secs"]  + dur2s(inc.get("published_duration","00:00:00")),
         json.dumps(srcs), now_ts(), uid))
    cx.commit(); cx.close()

def db_log(action, uid, name, detail):
    cx = get_conn()
    cx.execute("INSERT INTO merge_log(action,user_id,user_name,detail,merged_at) VALUES(?,?,?,?,?)",
               (action, uid, name, detail, now_ts()))
    cx.commit(); cx.close()

def all_users():
    cx = get_conn()
    rows = cx.execute("SELECT * FROM users ORDER BY uploaded_count DESC").fetchall()
    cx.close(); return [row_to_dict(r) for r in rows]

def all_logs():
    cx = get_conn()
    rows = cx.execute("SELECT * FROM merge_log ORDER BY id").fetchall()
    cx.close(); return [dict(r) for r in rows]

# ── csv helpers ────────────────────────────────────────────────────────────────
def load_csv(path, col_map=None):
    """Load a CSV using column names from the column mapper."""
    if col_map is None:
        col_map = DEFAULT_COL_MAP
    records = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            records.append({
                "user_name":          row[col_map["user_name"]].strip(),
                "uploaded_count":     int(row[col_map["uploaded_count"]]),
                "created_count":      int(row[col_map["created_count"]]),
                "published_count":    int(row[col_map["published_count"]]),
                "uploaded_duration":  row[col_map["uploaded_duration"]].strip(),
                "created_duration":   row[col_map["created_duration"]].strip(),
                "published_duration": row[col_map["published_duration"]].strip(),
            })
    return records

def export_csv(path, col_map=None):
    """Export merged DB to CSV using column names from the column mapper."""
    if col_map is None:
        col_map = DEFAULT_COL_MAP
    users = all_users()
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            col_map["user_name"],
            col_map["uploaded_count"],
            col_map["created_count"],
            col_map["published_count"],
            col_map["uploaded_duration"],
            col_map["created_duration"],
            col_map["published_duration"],
            "Source Files"
        ])
        for u in users:
            w.writerow([u["user_name"], u["uploaded_count"], u["created_count"],
                        u["published_count"], u["uploaded_duration"],
                        u["created_duration"], u["published_duration"],
                        u["source_files"]])
    return len(users)

# ── groq agent ────────────────────────────────────────────────────────────────
TOOLS = [{
    "type": "function",
    "function": {
        "name": "lookup_user_by_name",
        "description": "Search the database for a user by name.",
        "parameters": {"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}
    }
},{
    "type": "function",
    "function": {
        "name": "insert_new_user",
        "description": "Add a new user to the database. Only when no match exists.",
        "parameters": {"type":"object","properties":{
            "user_name":{"type":"string"},"uploaded_count":{"type":"integer"},
            "created_count":{"type":"integer"},"published_count":{"type":"integer"},
            "uploaded_duration":{"type":"string"},"created_duration":{"type":"string"},
            "published_duration":{"type":"string"}},"required":["user_name"]}
    }
},{
    "type": "function",
    "function": {
        "name": "update_existing_user",
        "description": "Accumulate new period counts onto existing user. All fields are ADDED.",
        "parameters": {"type":"object","properties":{
            "user_id":{"type":"integer"},"uploaded_count":{"type":"integer"},
            "created_count":{"type":"integer"},"published_count":{"type":"integer"},
            "uploaded_duration":{"type":"string"},"created_duration":{"type":"string"},
            "published_duration":{"type":"string"}},"required":["user_id"]}
    }
},{
    "type": "function",
    "function": {
        "name": "skip_user",
        "description": "Skip — incoming data is identical to existing record.",
        "parameters": {"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"]}
    }
}]

SYSTEM = """You are a Data Merger Agent for user activity CSVs.
For each incoming user: (1) call lookup_user_by_name, (2) decide:
  - not found → insert_new_user
  - found, identical data → skip_user
  - found, different data → update_existing_user (counts are ADDITIVE, different time period)
Always call exactly one action tool per user."""

def execute_tool(name, args, incoming, source):
    if name == "lookup_user_by_name":
        r = db_lookup(args["name"])
        return {"found": r is not None, "user": r}
    if name == "insert_new_user":
        uid = db_insert(args, source)
        db_log("insert", uid, args["user_name"], f"New user from '{source}'.")
        return {"action":"inserted","user_id":uid}
    if name == "update_existing_user":
        uid = args.pop("user_id")
        db_update(uid, args, source)
        db_log("update", uid, incoming["user_name"], f"Counts accumulated from '{source}'.")
        return {"action":"updated","user_id":uid}
    if name == "skip_user":
        db_log("skip", None, incoming["user_name"], args["reason"])
        return {"action":"skipped"}
    return {"error":"unknown tool"}


def deterministic_merge(incoming, source):
    """Fallback merge path when LLM tool-calling fails."""
    existing = db_lookup(incoming["user_name"])
    if not existing:
        return execute_tool("insert_new_user", dict(incoming), incoming, source)

    same_counts = (
        int(existing.get("uploaded_count", 0)) == int(incoming.get("uploaded_count", 0)) and
        int(existing.get("created_count", 0)) == int(incoming.get("created_count", 0)) and
        int(existing.get("published_count", 0)) == int(incoming.get("published_count", 0))
    )
    same_durations = (
        str(existing.get("uploaded_duration", "00:00:00")) == str(incoming.get("uploaded_duration", "00:00:00")) and
        str(existing.get("created_duration", "00:00:00")) == str(incoming.get("created_duration", "00:00:00")) and
        str(existing.get("published_duration", "00:00:00")) == str(incoming.get("published_duration", "00:00:00"))
    )

    if same_counts and same_durations:
        return execute_tool(
            "skip_user",
            {"reason": "Identical counts and durations to existing record."},
            incoming,
            source,
        )

    update_args = dict(incoming)
    update_args["user_id"] = existing["id"]
    return execute_tool("update_existing_user", update_args, incoming, source)

def run_agent_groq(incoming, client, source):
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user",   "content":
            f"Merge this user into the database:\n{json.dumps(incoming, indent=2)}"},
    ]
    result = {"action": None, "user_id": None}

    while True:
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
        except Exception as e:
            err = str(e)
            if "tool_use_failed" in err or "invalid_request_error" in err:
                print(f"    {c(DIM,'[Groq]')}   {c(YL,'tool call failed, using deterministic fallback')}" )
                fallback = deterministic_merge(incoming, source)
                result["action"] = fallback.get("action")
                result["user_id"] = fallback.get("user_id")
                col = {"inserted":GR,"updated":YL,"skipped":DIM}.get(fallback.get("action",""), WH)
                print(f"    {c(DIM,'[DB]')}     ← {c(col, str(fallback))}")
                break
            raise

        msg = response.choices[0].message
        messages.append(msg.model_dump(exclude_none=True))

        if msg.tool_calls:
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                tool_args = json.loads(tc.function.arguments)
                print(f"    {c(DIM,'[Groq]')}   {c(CY,'→ '+tool_name)}  {c(DIM,str(tool_args))}")
                tool_result = execute_tool(tool_name, tool_args, incoming, source)
                if "action" in tool_result:
                    result["action"]  = tool_result["action"]
                    result["user_id"] = tool_result.get("user_id")
                col = {"inserted":GR,"updated":YL,"skipped":DIM}.get(tool_result.get("action",""), WH)
                print(f"    {c(DIM,'[DB]')}     ← {c(col, str(tool_result))}")
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tc.id,
                    "content":      json.dumps(tool_result, default=str),
                })
        else:
            if msg.content:
                print(f"    {c(DIM,'[Groq]')}   {c(DIM, msg.content.strip()[:100])}")
            break

    return result

# ── pretty table ───────────────────────────────────────────────────────────────
def ptable(rows, cols, maxw=24):
    if not rows: print("  (empty)\n"); return
    w = {col: len(col) for col in cols}
    for r in rows:
        for col in cols:
            w[col] = min(max(w[col], len(str(r.get(col,"") or ""))), maxw)
    print("  " + " │ ".join(c(B, col.ljust(w[col])) for col in cols))
    print("  " + "─┼─".join("─"*w[col] for col in cols))
    for r in rows:
        parts = []
        for col in cols:
            v = str(r.get(col,"") or "")
            if len(v) > maxw: v = v[:maxw-1]+"…"
            parts.append(v.ljust(w[col]))
        print("  " + " │ ".join(parts))
    print()

def section(title):
    pad = 56-len(title); l=pad//2; r=pad-l
    print(f"\n{c(B+BL,'┌'+'─'*58+'┐')}")
    print(f"{c(B+BL,'│')}{' '*l}{c(B,title)}{' '*r}{c(B+BL,'│')}")
    print(f"{c(B+BL,'└'+'─'*58+'┘')}\n")

# ── main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="CSV Merger Agent")
    parser.add_argument("--baseline", help="Baseline CSV to initialise the DB")
    parser.add_argument("--incoming", help="New CSV to merge in")
    parser.add_argument("--export",   help="Export merged DB to this CSV path")
    parser.add_argument("--api-key",  help="Groq API key (or set GROQ_API_KEY env var)")
    parser.add_argument("--merge-datasets", action="store_true",
                        help="Merge multiple CSVs per dataset role (e.g. channel_platform1.csv + channel_platform2.csv)")
    args = parser.parse_args()

    load_env_file()
    api_key = args.api_key or os.environ.get("GROQ_API_KEY")

    print(f"\n{c(B+BL,'╔'+'═'*58+'╗')}")
    print(f"{c(B+BL,'║')}  {c(B,'CSV DATA MERGER AGENT')} — Groq-powered                {c(B+BL,'║')}")
    print(f"{c(B+BL,'╚'+'═'*58+'╝')}\n")

    init_db()
    print(f"  {c(GR,'✓')} DB ready: {c(DIM, DB_PATH)}\n")

    # ── load column mappings from column_mapper.py output ──────────────────
    col_map = load_column_mappings()
    if MAPPINGS_PATH.exists():
        print(f"  {c(GR,'+')} Column mappings loaded from {c(DIM, str(MAPPINGS_PATH))}")
        for sem, actual in col_map.items():
            print(f"      {c(CY, sem.ljust(22))} -> {c(WH, actual)}")
    else:
        print(f"  {c(YL,'!')} No column_mappings.json found -- using default column names")
    print()

    # ── load baseline 
    if args.baseline:
        section(f"LOADING BASELINE  →  {Path(args.baseline).name}")
        records = load_csv(args.baseline, col_map)
        source  = Path(args.baseline).name
        for r in records:
            db_insert(r, source)
        users = all_users()
        print(f"  {c(GR,'✓')} {len(users)} users loaded\n")
        ptable(users, ["id","user_name","uploaded_count","created_count","published_count","uploaded_duration"])

    # ── merge incoming 
    if args.incoming:
        if not api_key:
            print(c(RD, "  ERROR: Groq API key required for merging."))
            print("  Set GROQ_API_KEY env var or pass --api-key YOUR_KEY\n")
            sys.exit(1)

        from groq import Groq
        groq_client = Groq(api_key=api_key)

        source  = Path(args.incoming).name
        records = load_csv(args.incoming, col_map)

        section(f"MERGING  →  {source}  ({len(records)} rows)")
        counts = {"inserted":0,"updated":0,"skipped":0}
        summaries = []

        for i, rec in enumerate(records, 1):
            print(f"  {c(B,f'[{i:02d}/{len(records)}]')} {c(WH, rec['user_name'])}")
            result = run_agent_groq(rec, groq_client, source)
            counts[result["action"]] = counts.get(result["action"],0)+1
            summaries.append({"user":rec["user_name"],"action":result["action"],"id":result.get("user_id","")})
            print()

        section("MERGE SUMMARY")
        ptable(summaries, ["user","action","id"])
        bar_w = 30
        for action, col in [("inserted",GR),("updated",YL),("skipped",DIM)]:
            n = counts.get(action,0)
            bar = "█" * int(n/len(records)*bar_w)
            label = action.upper().ljust(10)
            print(f"  {c(col,label)} {c(col,bar)} {n}")
        print()

        section("DATABASE AFTER MERGE")
        after = all_users()
        ptable(after, ["id","user_name","uploaded_count","created_count","published_count","uploaded_duration","source_files"])

        section("AUDIT LOG")
        for e in all_logs():
            col = {"insert":GR,"update":YL,"skip":DIM}.get(e["action"],WH)
            print(f"  {c(DIM,e['merged_at'][11:19])}  {c(col,e['action'].upper().ljust(7))}"
                  f"  {c(WH,(e['user_name'] or '').ljust(22)[:22])}"
                  f"  {c(DIM,(e['detail'] or '')[:55])}")
        print()

    # ── export 
    if args.export:
        section(f"EXPORTING  ->  {args.export}")
        n = export_csv(args.export, col_map)
        print(f"  {c(GR,'+')} {n} rows exported to {c(DIM, args.export)}\n")

    # ── merge datasets (multi-role merge) 
    if args.merge_datasets:
        section("MERGE DATASETS BY ROLE")
        print(f"  Scanning {c(DIM, str(DATASETS_DIR))} ...\n")
        dataset_paths = merge_all_datasets()
        if dataset_paths:
            section("UPDATED DATASET_PATHS")
            for role, path in sorted(dataset_paths.items()):
                print(f"  {c(CY, role.ljust(22))} -> {c(DIM, Path(path).name)}")
            print()

    if not any([args.baseline, args.incoming, args.export, args.merge_datasets]):
        parser.print_help()

if __name__ == "__main__":
    main()
