"""
Analytics Engine — Main orchestrator for the adaptive analytics pipeline.

Handles:
1. Two-level change detection (schema hash vs data hash)
2. Three compute paths: cache, data_append, schema_change
3. Saved script management (generates on schema change, reuses on data append)
4. Assembles analytics_dashboard.json for frontend
"""
import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import pandas as pd

import sys
_backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_backend_dir.parent))

from config import DATA_DIR, AGENT_DIR, CHART_CATEGORIES, DATASETS_DIR

logger = logging.getLogger("analytics.engine")

HASHES_PATH = AGENT_DIR / "data" / "saved_analytics" / "dataset_hashes.json"
DASHBOARD_PATH = AGENT_DIR / "data" / "analytics_dashboard.json"
FRONTEND_DASHBOARD_PATH = AGENT_DIR / "frontend" / "public" / "data" / "analytics_dashboard.json"
NEW_FRONTEND_DASHBOARD_PATH = AGENT_DIR / "data_open_frontend" / "public" / "data" / "analytics_dashboard.json"
REGISTRY_PATH = Path(__file__).parent / "analytics_registry.json"
KPI_REGISTRY_PATH = Path(__file__).parent / "kpi_registry.json"
CHART_DATA_DIR = AGENT_DIR / "data" / "chart_data"

# Flag to use new modular KPI system vs legacy script-based system
USE_MODULAR_KPI_SYSTEM = True


# ─── Dataset Role Resolution ────────────────────────────────────────────────

def _load_registry_config() -> Dict:
    """Load the analytics_registry.json."""
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def resolve_dataset_role(filename: str, registry_datasets: Dict) -> Optional[str]:
    """
    Map a CSV filename to its logical role using registry patterns.
    Supports both 'filename_patterns' (AND) and 'filename_patterns_any' (OR groups).
    Most specific match (longest combined pattern) wins.
    """
    filename_lower = filename.lower()
    best_role = None
    best_score = -1

    for role, cfg in registry_datasets.items():
        excludes = cfg.get("filename_excludes", [])

        # Check no excludes match
        if any(e.lower() in filename_lower for e in excludes):
            continue

        # Support filename_patterns_any: list of pattern groups, ANY group can match
        patterns_any = cfg.get("filename_patterns_any", [])
        patterns = cfg.get("filename_patterns", [])

        matched_patterns = None
        if patterns_any:
            for group in patterns_any:
                if all(p.lower() in filename_lower for p in group):
                    # Use the best (longest) matching group
                    score = sum(len(p) for p in group)
                    if matched_patterns is None or score > sum(len(p) for p in matched_patterns):
                        matched_patterns = group
        elif patterns:
            if all(p.lower() in filename_lower for p in patterns):
                matched_patterns = patterns

        if matched_patterns is None:
            continue

        # Score by total pattern length (more specific = better)
        score = sum(len(p) for p in matched_patterns)
        if score > best_score:
            best_score = score
            best_role = role

    return best_role


# ─── Hashing ────────────────────────────────────────────────────────────────

def compute_file_hash(path: Path) -> str:
    """SHA-256 of file content in 64KB chunks."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def compute_schema_hash(df: pd.DataFrame) -> str:
    """SHA-256 of sorted column names. Detects structural changes only."""
    cols = sorted([c.strip() for c in df.columns.tolist()])
    return hashlib.sha256("|".join(cols).encode()).hexdigest()


def load_stored_hashes() -> Dict:
    """Load stored hashes from disk."""
    if HASHES_PATH.exists():
        try:
            return json.loads(HASHES_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_hashes(hashes: Dict) -> None:
    """Save hashes to disk."""
    HASHES_PATH.parent.mkdir(parents=True, exist_ok=True)
    HASHES_PATH.write_text(json.dumps(hashes, indent=2), encoding="utf-8")


# ─── Change Detection ───────────────────────────────────────────────────────

def detect_changes(data_dir: Path, registry_datasets: Dict) -> Dict[str, Any]:
    """
    Scan CSVs, classify each as: new, schema_change, data_append, unchanged.

    Returns:
        {
            "files": {filepath: {"role": str, "change_type": str, "schema_hash": str, "data_hash": str}},
            "schema_changed_roles": [str],
            "data_appended_roles": [str],
            "unchanged_roles": [str],
            "new_hashes": {filepath: {...}}
        }
    """
    stored = load_stored_hashes()
    result = {
        "files": {},
        "schema_changed_roles": [],
        "data_appended_roles": [],
        "unchanged_roles": [],
        "new_hashes": {}
    }

    csv_files = list(data_dir.glob("*.csv"))

    for csv_path in csv_files:
        filepath_key = str(csv_path)
        role = resolve_dataset_role(csv_path.name, registry_datasets)

        if role is None:
            continue  # Unrecognized by pattern matching, skip for change detection

        # Compute current hashes
        data_hash = compute_file_hash(csv_path)
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig", nrows=5)
            schema_hash = compute_schema_hash(df)
        except Exception as e:
            logger.warning(f"Failed to read {csv_path.name}: {e}")
            continue

        file_info = {
            "role": role,
            "schema_hash": schema_hash,
            "data_hash": data_hash,
            "path": filepath_key
        }
        result["new_hashes"][filepath_key] = {
            "schema_hash": schema_hash,
            "data_hash": data_hash,
            "role": role,
            "last_seen": datetime.now().isoformat()
        }

        # Classify change
        if filepath_key not in stored:
            file_info["change_type"] = "new"
            result["schema_changed_roles"].append(role)
        elif stored[filepath_key].get("schema_hash") != schema_hash:
            file_info["change_type"] = "schema_change"
            result["schema_changed_roles"].append(role)
        elif stored[filepath_key].get("data_hash") != data_hash:
            file_info["change_type"] = "data_append"
            result["data_appended_roles"].append(role)
        else:
            file_info["change_type"] = "unchanged"
            result["unchanged_roles"].append(role)

        result["files"][filepath_key] = file_info

    # Deduplicate roles
    result["schema_changed_roles"] = list(set(result["schema_changed_roles"]))
    result["data_appended_roles"] = list(set(result["data_appended_roles"]))
    result["unchanged_roles"] = list(set(result["unchanged_roles"]))

    return result


# ─── Dataset Loading ────────────────────────────────────────────────────────

def get_dataset_paths(data_dir: Path, registry_datasets: Dict) -> Dict[str, str]:
    """Resolve each dataset role to its file path.

    Two-tier: pattern matching (fast, no LLM) then LLM classification for unmatched files.
    """
    from analytics.role_classifier import classify_dataset_role as llm_classify, load_cached_classifications, save_cached_classifications

    paths = {}
    unmatched_files = []
    cache = load_cached_classifications()

    for csv_path in data_dir.glob("*.csv"):
        role = resolve_dataset_role(csv_path.name, registry_datasets)
        if role and role not in paths:
            paths[role] = str(csv_path)
        elif not role:
            unmatched_files.append(csv_path)

    # LLM classification for unmatched files
    for csv_path in unmatched_files:
        role = llm_classify(csv_path, registry_datasets, cache)
        if role and role not in paths:
            paths[role] = str(csv_path)

    save_cached_classifications(cache)
    return paths


def load_datasets_for_roles(roles: List[str], dataset_paths: Dict[str, str]) -> Dict[str, pd.DataFrame]:
    """Load DataFrames for specified roles."""
    dfs = {}
    for role in roles:
        path = dataset_paths.get(role)
        if path and Path(path).exists():
            try:
                dfs[role] = pd.read_csv(path, encoding="utf-8-sig")
            except Exception as e:
                logger.error(f"Failed to load {role}: {e}")
    return dfs


# ─── Dashboard Assembly ─────────────────────────────────────────────────────

def assemble_dashboard(
    metrics: list, chart_data: dict, change_info: dict,
    dataset_paths: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Assemble the complete analytics_dashboard.json."""
    # Group metrics by category
    by_category = {}
    for m in metrics:
        cat = m.get("category", "other")
        by_category.setdefault(cat, []).append(m)

    # Load chart file list from data dir
    charts_by_category = {}
    data_dir = Path(DATA_DIR)
    for category, filenames in CHART_CATEGORIES.items():
        chart_list = []
        for fname in filenames:
            chart_path = data_dir / fname
            if chart_path.exists():
                chart_list.append({"filename": fname, "url": f"/charts/{fname}"})
        if chart_list:
            charts_by_category[category] = chart_list

    # Dataset attribution: which files are powering the dashboard
    dataset_sources = {}
    if dataset_paths:
        for role, path in dataset_paths.items():
            dataset_sources[role] = {
                "filename": Path(path).name,
                "display_name": Path(path).stem,
            }

    dashboard = {
        "generated_at": datetime.now().isoformat(),
        "from_cache": False,
        "change_type": _determine_change_type(change_info),
        "metrics": metrics,
        "by_category": by_category,
        "count": len(metrics),
        "chart_data": chart_data,
        "charts": charts_by_category,
        "dataset_sources": dataset_sources,
    }

    # Save to disk (backend data dir)
    DASHBOARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    dashboard_json = json.dumps(dashboard, indent=2, default=str)
    DASHBOARD_PATH.write_text(dashboard_json, encoding="utf-8")

    # Also save to frontend public/ dirs so pages can read without backend
    for fe_path in (FRONTEND_DASHBOARD_PATH, NEW_FRONTEND_DASHBOARD_PATH):
        try:
            fe_path.parent.mkdir(parents=True, exist_ok=True)
            fe_path.write_text(dashboard_json, encoding="utf-8")
            logger.info(f"Saved frontend dashboard to {fe_path}")
        except Exception as e:
            logger.warning(f"Could not write frontend dashboard to {fe_path}: {e}")

    logger.info(f"Saved analytics dashboard: {len(metrics)} metrics, {len(chart_data)} chart datasets")

    return dashboard


def load_cached_dashboard() -> Optional[Dict]:
    """Load cached dashboard from disk."""
    if DASHBOARD_PATH.exists():
        try:
            dashboard = json.loads(DASHBOARD_PATH.read_text(encoding="utf-8"))
            dashboard["from_cache"] = True
            return dashboard
        except Exception as e:
            logger.warning(f"Failed to load cached dashboard: {e}")
    return None


def _determine_change_type(change_info: dict) -> str:
    if change_info.get("schema_changed_roles"):
        return "schema_change"
    elif change_info.get("data_appended_roles"):
        return "data_append"
    return "none"


# ─── Main Engine ─────────────────────────────────────────────────────────────

class AnalyticsEngine:
    """
    Singleton orchestrator. Manages the full analytics pipeline.
    """

    def __init__(self):
        self._config = _load_registry_config()
        self._data_dir = DATASETS_DIR

    def run(self, force: bool = False) -> Dict[str, Any]:
        """
        Main entry point. Called on startup and manual refresh.

        Flow:
        1. Detect changes (schema_hash + data_hash)
        2. Route to appropriate path
        3. Return analytics dashboard
        """
        registry_datasets = self._config.get("datasets", {})

        # Step 1: Detect changes
        change_info = detect_changes(self._data_dir, registry_datasets)
        schema_changes = change_info["schema_changed_roles"]
        data_appends = change_info["data_appended_roles"]

        logger.info(f"Change detection: schema_changed={schema_changes}, data_appended={data_appends}, unchanged={change_info['unchanged_roles']}")

        # Step 2: Route
        if not force and not schema_changes and not data_appends:
            # CACHE PATH
            cached = load_cached_dashboard()
            if cached:
                logger.info("CACHE PATH: No changes detected, serving cached dashboard")
                return cached
            else:
                logger.info("No cache found, treating as first run")
                schema_changes = list(set(
                    f["role"] for f in change_info["files"].values()
                ))

        dataset_paths = get_dataset_paths(self._data_dir, registry_datasets)

        if schema_changes or force:
            # SCHEMA CHANGE PATH — run column mapper + regenerate scripts
            return self._schema_change_path(change_info, dataset_paths, registry_datasets, force)
        else:
            # DATA APPEND PATH — re-run saved scripts only
            return self._data_append_path(change_info, dataset_paths)

    def _schema_change_path(
        self,
        change_info: Dict,
        dataset_paths: Dict[str, str],
        registry_datasets: Dict,
        force: bool = False
    ) -> Dict[str, Any]:
        """Full pipeline: column mapper -> dataset merger -> KPI computation."""
        logger.info("SCHEMA CHANGE PATH: Running column mapper + merger + KPI computation")

        from analytics.column_mapper import run_column_mapper, load_persisted_mappings

        schema_roles = change_info.get("schema_changed_roles", [])
        if force:
            schema_roles = list(dataset_paths.keys())

        # Load DataFrames for changed roles
        dfs = load_datasets_for_roles(schema_roles, dataset_paths)

        # Run column mapper (LLM)
        existing_mappings = load_persisted_mappings()
        column_mappings = run_column_mapper(
            role_to_df=dfs,
            registry_datasets=registry_datasets,
            existing_mappings=existing_mappings,
            changed_roles=schema_roles
        )

        # ── Run dataset merger (after column mapping) ─────────────────────
        # Merges multi-file roles (e.g. channel_platform1.csv + channel_platform2.csv)
        # and updates dataset_paths to point to the merged output files.
        # Also updates column_mappings to identity (semantic names) after normalization.
        dataset_paths, column_mappings = self._run_merger(registry_datasets, column_mappings, dataset_paths)

        # Compute KPIs and chart data using modular system or legacy scripts
        if USE_MODULAR_KPI_SYSTEM:
            from analytics.kpi_executor import compute_kpis_from_registry, compute_charts_from_registry
            metrics = compute_kpis_from_registry(column_mappings, dataset_paths)
            chart_data = compute_charts_from_registry(column_mappings, dataset_paths)
        else:
            # Legacy: generate and execute scripts
            from analytics.script_generator import generate_all_scripts
            from analytics.script_executor import execute_kpi_script, execute_chart_data_script
            generate_all_scripts(column_mappings, dataset_paths, trigger="schema_change")
            metrics = execute_kpi_script() or []
            execute_chart_data_script()
            chart_data = self._load_chart_data()

        # Save metrics to SQLite registry
        self._save_metrics_to_registry(metrics)

        # Register/update datasets in registry.db
        self._register_datasets_in_db(dataset_paths)

        # Save hashes
        save_hashes(change_info["new_hashes"])

        # Assemble dashboard
        dashboard = assemble_dashboard(metrics, chart_data, change_info, dataset_paths=dataset_paths)
        dashboard["kpis_recomputed"] = [m.get("id", m.get("name")) for m in metrics]
        dashboard["change_type"] = "schema_change"

        return dashboard

    def _run_merger(
        self,
        registry_datasets: Dict,
        column_mappings: Dict,
        dataset_paths: Dict[str, str]
    ) -> tuple:
        """Run the dataset merger to combine multi-file roles.
        Called after column mapping in both schema_change and data_append paths.
        
        Returns:
            (updated_dataset_paths, updated_column_mappings) tuple
        """
        try:
            from analytics.merger import merge_datasets_for_pipeline
            updated_paths, updated_mappings = merge_datasets_for_pipeline(
                registry_datasets=registry_datasets,
                column_mappings=column_mappings,
                dataset_paths=dataset_paths,
            )
            return updated_paths, updated_mappings
        except Exception as e:
            logger.warning(f"Dataset merger failed (non-fatal): {e}")
            return dataset_paths, column_mappings

    def _data_append_path(
        self,
        change_info: Dict,
        dataset_paths: Dict[str, str]
    ) -> Dict[str, Any]:
        """Re-run computation with existing column mappings. No LLM needed."""
        logger.info("DATA APPEND PATH: Re-computing with existing mappings")

        from analytics.column_mapper import load_persisted_mappings
        mappings = load_persisted_mappings()

        # ── Run dataset merger (reuse existing mappings) ──────────────────
        registry_datasets = self._config.get("datasets", {})
        dataset_paths, mappings = self._run_merger(registry_datasets, mappings, dataset_paths)

        if USE_MODULAR_KPI_SYSTEM:
            from analytics.kpi_executor import compute_kpis_from_registry, compute_charts_from_registry
            metrics = compute_kpis_from_registry(mappings, dataset_paths)
            chart_data = compute_charts_from_registry(mappings, dataset_paths)
        else:
            # Legacy: check scripts exist, regenerate paths, execute
            from analytics.script_executor import execute_kpi_script, execute_chart_data_script, scripts_exist
            from analytics.script_generator import generate_all_scripts
            
            if not scripts_exist():
                logger.warning("Saved scripts not found, escalating to schema change path")
                registry_datasets = self._config.get("datasets", {})
                change_info["schema_changed_roles"] = list(dataset_paths.keys())
                return self._schema_change_path(change_info, dataset_paths, registry_datasets)
            
            generate_all_scripts(mappings, dataset_paths, trigger="data_append")
            metrics = execute_kpi_script() or []
            execute_chart_data_script()
            chart_data = self._load_chart_data()

        # Save metrics to SQLite registry
        self._save_metrics_to_registry(metrics)

        # Register/update datasets in registry.db
        self._register_datasets_in_db(dataset_paths)

        # Save hashes
        save_hashes(change_info["new_hashes"])

        # Assemble dashboard
        dashboard = assemble_dashboard(metrics, chart_data, change_info, dataset_paths=dataset_paths)
        dashboard["kpis_recomputed"] = [m.get("id", m.get("name")) for m in metrics]
        dashboard["change_type"] = "data_append"

        return dashboard

    def _load_chart_data(self) -> Dict[str, Any]:
        """Load all chart data JSONs from the chart_data directory."""
        chart_data = {}
        if CHART_DATA_DIR.exists():
            for json_file in CHART_DATA_DIR.glob("*.json"):
                try:
                    key = json_file.stem  # e.g., "monthly_trends"
                    chart_data[key] = json.loads(json_file.read_text(encoding="utf-8"))
                except Exception as e:
                    logger.warning(f"Failed to load chart data {json_file.name}: {e}")
        return chart_data

    def _save_metrics_to_registry(self, metrics: list) -> None:
        """Save computed metrics to SQLite registry for backward compatibility."""
        try:
            from context_manager import get_registry
            registry = get_registry()
            for m in metrics:
                registry.save_metric(
                    name=m.get("name", m.get("id", "")),
                    value=float(m.get("value", 0)) if isinstance(m.get("value"), (int, float)) else 0,
                    formatted=m.get("formatted", ""),
                    category=m.get("category", ""),
                    description=m.get("description", "")
                )
            logger.info(f"Saved {len(metrics)} metrics to registry.db")
        except Exception as e:
            logger.warning(f"Failed to save metrics to registry: {e}")

    def _register_datasets_in_db(self, dataset_paths: Dict[str, str]) -> None:
        """Register/update all active datasets in registry.db.
        Called every pipeline run to keep the DB in sync with current datasets.
        This populates the datasets + columns tables alongside the metrics table."""
        try:
            from context_manager import get_registry
            registry = get_registry()
            # Wipe stale entries so only current pipeline datasets are visible
            registry.clear_all_datasets()
            registered = 0
            for role, path in dataset_paths.items():
                try:
                    dataset_id = registry.register_dataset(
                        file_path=path,
                        name=role,
                        domain_tags=[role]
                    )
                    registered += 1
                    logger.debug(f"Registered dataset '{role}' (id={dataset_id}) in registry.db")
                except Exception as e:
                    logger.warning(f"Failed to register dataset '{role}': {e}")
            logger.info(f"Registered {registered}/{len(dataset_paths)} datasets in registry.db")
        except Exception as e:
            logger.warning(f"Failed to register datasets in registry: {e}")

    def get_dashboard(self) -> Dict[str, Any]:
        """Get the analytics dashboard. Checks for dataset changes on every call.
        If nothing changed, returns cached (~50ms). If data changed, recomputes."""
        return self.run()

    def get_kpi_summary(self) -> Dict[str, Any]:
        """Return KPI summary in the format expected by the existing /kpi-summary endpoint."""
        dashboard = self.get_dashboard()
        return {
            "metrics": dashboard.get("metrics", []),
            "by_category": dashboard.get("by_category", {}),
            "count": dashboard.get("count", 0)
        }


# ─── Singleton ───────────────────────────────────────────────────────────────

_engine_instance: Optional[AnalyticsEngine] = None


def get_engine() -> AnalyticsEngine:
    """Get or create the singleton engine instance."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = AnalyticsEngine()
    return _engine_instance


def run_analytics(force: bool = False) -> Dict[str, Any]:
    """Module-level entry point for session.py to call."""
    return get_engine().run(force=force)
