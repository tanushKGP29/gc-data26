"""
KPI Executor - Reads registry, loads data, calls KPI functions by name.

This module:
1. Loads KPI definitions from kpi_registry.json
2. For each KPI, looks up the function by name in kpi_functions.py
3. Calls the function with the appropriate dataset and column mappings
4. Returns formatted results

The pipeline remains the same, but KPIs are now fully modular.
"""
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import pandas as pd

from .kpi_functions import get_kpi_function, KPI_FUNCTION_REGISTRY

logger = logging.getLogger("analytics.kpi_executor")

REGISTRY_PATH = Path(__file__).parent / "kpi_registry.json"
FRONTEND_COMPUTE_PATH = Path(__file__).parent / "frontend_compute.json"
CHART_DATA_DIR = Path(__file__).parent.parent.parent / "data" / "chart_data"


class KPIExecutor:
    """
    Executes KPIs based on registry definitions by calling named functions.
    
    - kpi_registry.json = Full library of all KPIs/charts (reference)
    - frontend_compute.json = Which KPIs/charts to actually compute for frontend
    """
    
    def __init__(self, registry_path: Path = REGISTRY_PATH):
        self.registry_path = registry_path
        self._registry = None
        self._frontend_compute = None
        self._column_mappings: Dict[str, Dict[str, str]] = {}
        self._dataset_cache: Dict[str, pd.DataFrame] = {}
        self._dataset_paths: Dict[str, str] = {}
    
    def load_registry(self) -> Dict:
        """Load the full KPI registry (library of all KPIs/charts)."""
        if self._registry is None:
            self._registry = json.loads(self.registry_path.read_text(encoding="utf-8"))
        return self._registry
    
    def load_frontend_compute(self) -> Dict:
        """Load frontend_compute.json (which KPIs/charts to actually compute)."""
        if self._frontend_compute is None:
            if FRONTEND_COMPUTE_PATH.exists():
                self._frontend_compute = json.loads(FRONTEND_COMPUTE_PATH.read_text(encoding="utf-8"))
            else:
                # Fallback: compute all KPIs/charts from registry
                self._frontend_compute = {"kpis": None, "charts": None}
        return self._frontend_compute
    
    def reload_registry(self) -> Dict:
        """Force reload the registry (useful after adding new KPIs)."""
        self._registry = None
        self._frontend_compute = None
        return self.load_registry()
    
    def set_column_mappings(self, mappings: Dict[str, Dict[str, str]]) -> None:
        """Set column mappings from column_mapper."""
        self._column_mappings = mappings
    
    def set_dataset_paths(self, paths: Dict[str, str]) -> None:
        """Set dataset paths."""
        self._dataset_paths = paths
        self._dataset_cache.clear()
    
    def _load_dataset(self, dataset_name: str) -> Optional[pd.DataFrame]:
        """Load a dataset by name, using cache."""
        if dataset_name in self._dataset_cache:
            return self._dataset_cache[dataset_name]
        
        path = self._dataset_paths.get(dataset_name)
        if not path or not Path(path).exists():
            logger.warning(f"Dataset '{dataset_name}' not found at path: {path}")
            return None
        
        try:
            df = pd.read_csv(path, encoding="utf-8-sig")
            self._dataset_cache[dataset_name] = df
            return df
        except Exception as e:
            logger.error(f"Failed to load dataset '{dataset_name}': {e}")
            return None
    
    def _get_column_mapping(self, dataset_name: str) -> Dict[str, str]:
        """Get column mapping for a dataset."""
        return self._column_mappings.get(dataset_name, {})
    
    # ─── KPI Computation ─────────────────────────────────────────────────────
    
    def compute_kpi(self, kpi_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Compute a single KPI by calling its named function."""
        kpi_id = kpi_config.get("id", "unknown")
        function_name = kpi_config.get("function")
        
        if not function_name:
            logger.warning(f"KPI '{kpi_id}' has no function defined")
            return None
        
        # Get the function from registry
        func = get_kpi_function(function_name)
        if not func:
            logger.warning(f"Function '{function_name}' not found for KPI '{kpi_id}'")
            return None
        
        # Build datasets dict from required datasets
        input_spec = kpi_config.get("input", {})
        required_datasets = input_spec.get("datasets", [])
        
        datasets = {}
        for ds_name in required_datasets:
            df = self._load_dataset(ds_name)
            if df is not None:
                datasets[ds_name] = df
        
        if not datasets:
            logger.warning(f"Skipping KPI '{kpi_id}': no datasets available")
            return None
        
        # Build columns mapping - after merger normalization, CSVs use semantic names directly
        columns = {}
        col_specs = input_spec.get("columns", {})
        for col_semantic, col_info in col_specs.items():
            # Prefer semantic name (CSVs are normalized), fall back to mapping then default
            actual_col = col_semantic
            # Check if the semantic name exists in any loaded dataset
            found_semantic = any(
                col_semantic in self._load_dataset(ds_name).columns
                for ds_name in required_datasets
                if self._load_dataset(ds_name) is not None
            )
            if not found_semantic:
                # Fall back to column_mapper mapping or registry default
                default_col = col_info.get("default", col_semantic)
                actual_col = default_col
                for ds_name in required_datasets:
                    ds_mapping = self._get_column_mapping(ds_name)
                    if col_semantic in ds_mapping:
                        actual_col = ds_mapping[col_semantic]
                        break
            columns[col_semantic] = actual_col
        
        # Call the function with new signature
        try:
            value = func(datasets, columns)
        except Exception as e:
            logger.error(f"Error computing KPI '{kpi_id}': {e}")
            return None
        
        # Format value
        format_str = kpi_config.get("format", "{}")
        try:
            formatted = format_str.format(value)
        except:
            formatted = str(value)
        
        return {
            "id": kpi_id,
            "name": kpi_config.get("name", kpi_id),
            "value": value,
            "formatted": formatted,
            "category": kpi_config.get("category", "other"),
            "description": kpi_config.get("description", ""),
            "unit": kpi_config.get("unit", ""),
            "function": function_name,
            "dataset_sources": required_datasets,
        }
    
    def compute_all_kpis(self, for_frontend: bool = True) -> List[Dict[str, Any]]:
        """
        Compute KPIs.
        
        Args:
            for_frontend: If True, only compute KPIs listed in frontend_compute.json
                         If False, compute ALL KPIs from registry (full library)
        """
        registry = self.load_registry()
        all_kpis = registry.get("kpis", [])
        
        # Filter by frontend_compute.json if requested
        if for_frontend:
            frontend = self.load_frontend_compute()
            kpi_ids_to_compute = frontend.get("kpis")
            if kpi_ids_to_compute is not None:
                all_kpis = [k for k in all_kpis if k.get("id") in kpi_ids_to_compute]
        
        results = []
        for kpi_config in all_kpis:
            result = self.compute_kpi(kpi_config)
            if result:
                results.append(result)
        
        logger.info(f"Computed {len(results)} KPIs (for_frontend={for_frontend})")
        return results
    
    def compute_kpi_by_id(self, kpi_id: str) -> Optional[Dict[str, Any]]:
        """Compute a single KPI by its ID."""
        kpi_config = self.get_kpi_by_id(kpi_id)
        if not kpi_config:
            return None
        return self.compute_kpi(kpi_config)
    
    # ─── Chart Data Computation ──────────────────────────────────────────────
    
    def compute_chart_data(self, chart_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Compute chart data based on config."""
        chart_id = chart_config.get("id", "unknown")
        dataset_name = chart_config.get("dataset")
        chart_type = chart_config.get("type", "table")
        
        df = self._load_dataset(dataset_name)
        if df is None:
            logger.warning(f"Skipping chart '{chart_id}': dataset '{dataset_name}' not available")
            return None
        
        col_map = self._get_column_mapping(dataset_name)
        
        # Handle different chart types
        if chart_type == "funnel":
            return self._compute_funnel(chart_id, df, chart_config, col_map)
        elif chart_type == "platform_aggregate":
            return self._compute_platform_aggregate(chart_id, df, chart_config, col_map)
        else:
            return self._compute_table_chart(chart_id, df, chart_config, col_map)
    
    def _compute_table_chart(
        self, 
        chart_id: str, 
        df: pd.DataFrame, 
        config: Dict, 
        col_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """Compute table/bar/line/pie chart data."""
        columns = config.get("columns", [])
        output_keys = config.get("output_keys", columns)
        compute_fields = config.get("compute_fields", [])
        transform = config.get("transform", {})
        colors = config.get("colors", [])
        
        # Map semantic columns to actual columns (prefer semantic name since CSVs are normalized)
        actual_cols = [c if c in df.columns else col_map.get(c, c) for c in columns]

        # Filter to existing columns
        existing_cols = [c for c in actual_cols if c in df.columns]
        if not existing_cols:
            logger.warning(f"No valid columns for chart '{chart_id}'")
            return {"id": chart_id, "data": []}
        
        data = []
        for _, row in df.iterrows():
            item = {}
            for i, col in enumerate(columns):
                actual_col = col if col in df.columns else col_map.get(col, col)
                if actual_col in df.columns:
                    key = output_keys[i] if i < len(output_keys) else col
                    val = row.get(actual_col, 0)
                    # Convert to numeric if possible
                    try:
                        val = int(pd.to_numeric(val, errors="coerce") or 0)
                    except:
                        val = str(val).strip().strip('"')
                    item[key] = val
            
            # Compute derived fields
            for field in compute_fields:
                num_key = field["numerator"]
                den_key = field["denominator"]
                num_col = num_key if num_key in df.columns else col_map.get(num_key, num_key)
                den_col = den_key if den_key in df.columns else col_map.get(den_key, den_key)
                num_val = pd.to_numeric(row.get(num_col, 0), errors="coerce") or 0
                den_val = pd.to_numeric(row.get(den_col, 0), errors="coerce") or 0
                
                if "* 100" in field.get("formula", ""):
                    item[field["name"]] = round(num_val / den_val * 100, 2) if den_val > 0 else 0
                else:
                    item[field["name"]] = round(num_val / den_val, 2) if den_val > 0 else 0
            
            # Apply transform (e.g., prefix)
            if transform.get("prefix_column") and transform.get("prefix"):
                key = output_keys[columns.index(transform["prefix_column"])] if transform["prefix_column"] in columns else None
                if key and key in item:
                    item[key] = f"{transform['prefix']}{item[key]}"
            
            # Add color for pie charts
            if colors and len(data) < len(colors):
                item["color"] = colors[len(data)]
            
            data.append(item)
        
        # Sort by value for pie charts
        if config.get("type") == "pie" and data:
            value_key = output_keys[-1] if len(output_keys) > 1 else "value"
            data.sort(key=lambda x: x.get(value_key, 0), reverse=True)
        
        return {"id": chart_id, "data": data}
    
    def _compute_funnel(
        self, 
        chart_id: str, 
        df: pd.DataFrame, 
        config: Dict, 
        col_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """Compute funnel chart data."""
        stages = config.get("stages", [])
        data = []
        
        for stage in stages:
            stage_key = stage["column"]
            col = stage_key if stage_key in df.columns else col_map.get(stage_key, stage_key)
            if col in df.columns:
                value = int(pd.to_numeric(df[col], errors="coerce").sum())
                data.append({"stage": stage["name"], "value": value})
        
        return {"id": chart_id, "data": data}
    
    def _compute_platform_aggregate(
        self, 
        chart_id: str, 
        df: pd.DataFrame, 
        config: Dict, 
        col_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """Compute platform aggregate (sum all numeric columns except one)."""
        excl_key = config.get("exclude_column", "")
        exclude_col = excl_key if excl_key in df.columns else col_map.get(excl_key, excl_key)
        
        data = []
        for col in df.columns:
            if col == exclude_col:
                continue
            total = int(pd.to_numeric(df[col], errors="coerce").sum())
            if total > 0:
                data.append({"name": col, "value": total})
        
        data.sort(key=lambda x: x["value"], reverse=True)
        return {"id": chart_id, "data": data}
    
    def compute_all_chart_data(self, for_frontend: bool = True) -> Dict[str, Any]:
        """
        Compute chart data.
        
        Args:
            for_frontend: If True, only compute charts listed in frontend_compute.json
                         If False, compute ALL charts from registry (full library)
        """
        registry = self.load_registry()
        all_charts = registry.get("chart_data", [])
        
        # Filter by frontend_compute.json if requested
        if for_frontend:
            frontend = self.load_frontend_compute()
            chart_ids_to_compute = frontend.get("charts")
            if chart_ids_to_compute is not None:
                all_charts = [c for c in all_charts if c.get("id") in chart_ids_to_compute]
        
        results = {}
        for chart_config in all_charts:
            result = self.compute_chart_data(chart_config)
            if result and result.get("data"):
                chart_id = result["id"]
                results[chart_id] = result["data"]
                
                # Save to file
                self._save_chart_data(chart_id, result["data"])
        
        logger.info(f"Computed {len(results)} charts (for_frontend={for_frontend})")
        return results
    
    def _save_chart_data(self, chart_id: str, data: Any) -> None:
        """Save chart data to JSON file."""
        CHART_DATA_DIR.mkdir(parents=True, exist_ok=True)
        path = CHART_DATA_DIR / f"{chart_id}.json"
        path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    
    # ─── Query Methods ───────────────────────────────────────────────────────
    
    def list_kpis(self, category: Optional[str] = None, frontend_only: bool = False) -> List[Dict[str, Any]]:
        """
        List KPI definitions.
        
        Args:
            category: Filter by category
            frontend_only: If True, only return KPIs in frontend_compute.json
        """
        registry = self.load_registry()
        kpis = registry.get("kpis", [])
        
        if frontend_only:
            frontend = self.load_frontend_compute()
            kpi_ids = frontend.get("kpis")
            if kpi_ids is not None:
                kpis = [k for k in kpis if k.get("id") in kpi_ids]
        
        if category:
            kpis = [k for k in kpis if k.get("category") == category]
        
        return kpis
    
    def list_charts(self, frontend_only: bool = False) -> List[Dict[str, Any]]:
        """
        List chart data definitions.
        
        Args:
            frontend_only: If True, only return charts in frontend_compute.json
        """
        registry = self.load_registry()
        charts = registry.get("chart_data", [])
        
        if frontend_only:
            frontend = self.load_frontend_compute()
            chart_ids = frontend.get("charts")
            if chart_ids is not None:
                charts = [c for c in charts if c.get("id") in chart_ids]
        
        return charts
    
    def get_kpi_by_id(self, kpi_id: str) -> Optional[Dict[str, Any]]:
        """Get a single KPI definition by ID."""
        registry = self.load_registry()
        for kpi in registry.get("kpis", []):
            if kpi.get("id") == kpi_id:
                return kpi
        return None
    
    def list_categories(self) -> List[str]:
        """List all KPI categories."""
        registry = self.load_registry()
        categories = set()
        for kpi in registry.get("kpis", []):
            if kpi.get("category"):
                categories.add(kpi["category"])
        return sorted(list(categories))
    
    def list_kpi_functions(self) -> List[str]:
        """List all available KPI function names."""
        return list(KPI_FUNCTION_REGISTRY.keys())
    
    def get_kpi_function_info(self, function_name: str) -> Optional[Dict[str, str]]:
        """Get info about a KPI function from its docstring."""
        from .kpi_functions import get_kpi_function_info
        return get_kpi_function_info(function_name)
    
    def get_frontend_compute_config(self) -> Dict:
        """Get the frontend_compute.json config."""
        return self.load_frontend_compute()


# ─── Singleton ───────────────────────────────────────────────────────────────

_executor_instance: Optional[KPIExecutor] = None


def get_kpi_executor() -> KPIExecutor:
    """Get or create the singleton executor instance."""
    global _executor_instance
    if _executor_instance is None:
        _executor_instance = KPIExecutor()
    return _executor_instance


def compute_kpis_from_registry(
    column_mappings: Dict[str, Dict[str, str]],
    dataset_paths: Dict[str, str],
    for_frontend: bool = True
) -> List[Dict[str, Any]]:
    """
    Main entry point for analytics_engine to compute KPIs.
    
    Args:
        column_mappings: From column_mapper
        dataset_paths: Dataset role -> file path
        for_frontend: If True, only compute KPIs in frontend_compute.json
    """
    executor = get_kpi_executor()
    executor.set_column_mappings(column_mappings)
    executor.set_dataset_paths(dataset_paths)
    return executor.compute_all_kpis(for_frontend=for_frontend)


def compute_charts_from_registry(
    column_mappings: Dict[str, Dict[str, str]],
    dataset_paths: Dict[str, str],
    for_frontend: bool = True
) -> Dict[str, Any]:
    """
    Main entry point for analytics_engine to compute chart data.
    
    Args:
        column_mappings: From column_mapper
        dataset_paths: Dataset role -> file path
        for_frontend: If True, only compute charts in frontend_compute.json
    """
    executor = get_kpi_executor()
    executor.set_column_mappings(column_mappings)
    executor.set_dataset_paths(dataset_paths)
    return executor.compute_all_chart_data(for_frontend=for_frontend)
