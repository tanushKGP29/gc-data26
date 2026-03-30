"""
Session Bootstrap - Initialize datasets and context on startup.
Scans data directory, profiles datasets, loads pre-saved metrics.
"""
import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))
from config import (
    DATA_DIR, SESSION_CONTEXT_PATH, SUPPORTED_DATA_EXTENSIONS,
    CHART_CATEGORIES, AGENT_DIR
)
from context_manager import get_registry


class SessionBootstrap:
    """Handles session initialization and context loading."""
    
    def __init__(self):
        self.registry = get_registry()
        self.data_dir = Path(DATA_DIR)
        self.metrics_loaded = False
        self.charts_indexed = False
    
    def bootstrap(self) -> Dict[str, Any]:
        """
        Run full bootstrap sequence.
        
        Returns:
            Status dictionary with loaded datasets and metrics
        """
        result = {
            "datasets_loaded": 0,
            "metrics_loaded": 0,
            "charts_found": 0,
            "errors": []
        }
        
        # 1. Scan and register datasets
        try:
            datasets = self._scan_and_register_datasets()
            result["datasets_loaded"] = len(datasets)
        except Exception as e:
            result["errors"].append(f"Dataset scan failed: {str(e)}")
        
        # 2. Build semantic index
        try:
            self._build_semantic_index()
        except Exception as e:
            result["errors"].append(f"Semantic indexing failed: {str(e)}")
        
        # 3. Load pre-saved metrics/KPIs
        try:
            metrics = self._load_saved_context()
            result["metrics_loaded"] = len(metrics)
        except Exception as e:
            result["errors"].append(f"Metrics loading failed: {str(e)}")
        
        # 4. Index existing charts
        try:
            charts = self._index_charts()
            result["charts_found"] = len(charts)
        except Exception as e:
            result["errors"].append(f"Chart indexing failed: {str(e)}")
        
        # 5. Extract KPIs from data if no saved metrics
        if result["metrics_loaded"] == 0:
            try:
                extracted = self._extract_baseline_kpis()
                result["metrics_loaded"] = len(extracted)
            except Exception as e:
                result["errors"].append(f"KPI extraction failed: {str(e)}")
        
        return result
    
    def _scan_and_register_datasets(self) -> List[Dict[str, Any]]:
        """Scan data directory and register all data files."""
        registered = []
        
        for ext in SUPPORTED_DATA_EXTENSIONS:
            for file_path in self.data_dir.glob(f"*{ext}"):
                # Skip already registered
                existing = self.registry.get_dataset_by_name(file_path.stem)
                if existing:
                    registered.append(existing)
                    continue
                
                try:
                    dataset_id = self.registry.register_dataset(
                        file_path=str(file_path),
                        name=file_path.stem
                    )
                    dataset = self.registry.get_dataset(dataset_id)
                    if dataset:
                        registered.append(dataset)
                except Exception as e:
                    print(f"Warning: Failed to register {file_path.name}: {e}")
        
        return registered
    
    def _build_semantic_index(self):
        """Placeholder — semantic indexing removed (was using chromadb + sentence-transformers)."""
        pass
    
    def _load_saved_context(self) -> List[Dict[str, Any]]:
        """Load pre-saved session context (metrics, findings)."""
        if not SESSION_CONTEXT_PATH.exists():
            return []
        
        try:
            context = json.loads(SESSION_CONTEXT_PATH.read_text())
            
            # Load metrics into registry
            for metric in context.get("metrics", []):
                self.registry.save_metric(
                    name=metric["name"],
                    value=metric.get("value", 0),
                    formatted=metric.get("formatted", ""),
                    category=metric.get("category", ""),
                    description=metric.get("description", "")
                )
            
            self.metrics_loaded = True
            return context.get("metrics", [])
            
        except Exception as e:
            print(f"Warning: Failed to load session context: {e}")
            return []
    
    def _index_charts(self) -> List[Dict[str, Any]]:
        """Index existing PNG charts from analysis."""
        from frammer_agent.tools import list_existing_charts
        
        charts = list_existing_charts()
        self.charts_indexed = True
        return charts
    
    def _extract_baseline_kpis(self) -> List[Dict[str, Any]]:
        """Extract baseline KPIs using the adaptive analytics engine."""
        try:
            from analytics.analytics_engine import run_analytics
            result = run_analytics()
            metrics = result.get("metrics", [])
            print(f"Analytics engine: {len(metrics)} KPIs computed (change_type={result.get('change_type', 'unknown')})")
            return metrics
        except Exception as e:
            print(f"Warning: Analytics engine failed: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_kpi_summary(self) -> Dict[str, Any]:
        """Get summary of all loaded KPIs for UI."""
        metrics = self.registry.get_metrics()
        
        # Group by category
        by_category = {}
        for m in metrics:
            cat = m.get("category", "other")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(m)
        
        return {
            "metrics": metrics,
            "by_category": by_category,
            "count": len(metrics)
        }
    
    def get_charts_by_category(self) -> Dict[str, List[Dict]]:
        """Get existing charts organized by category."""
        from frammer_agent.tools import list_existing_charts
        
        all_charts = list_existing_charts()
        chart_map = {c["filename"]: c for c in all_charts}
        
        result = {}
        for category, filenames in CHART_CATEGORIES.items():
            result[category] = []
            for fname in filenames:
                if fname in chart_map:
                    result[category].append(chart_map[fname])
        
        # Add uncategorized charts
        categorized = set()
        for filenames in CHART_CATEGORIES.values():
            categorized.update(filenames)
        
        uncategorized = [c for c in all_charts if c["filename"] not in categorized]
        if uncategorized:
            result["Other"] = uncategorized
        
        return result


# ─── Module Functions ────────────────────────────────────────────────────────

_bootstrap_instance: Optional[SessionBootstrap] = None

def get_bootstrap() -> SessionBootstrap:
    """Get or create the bootstrap instance."""
    global _bootstrap_instance
    if _bootstrap_instance is None:
        _bootstrap_instance = SessionBootstrap()
    return _bootstrap_instance


def run_bootstrap() -> Dict[str, Any]:
    """Run the bootstrap sequence."""
    bootstrap = get_bootstrap()
    return bootstrap.bootstrap()


def save_session_context(metrics: List[Dict], findings: Optional[List[str]] = None):
    """Save session context for future loads."""
    context = {
        "metrics": metrics,
        "findings": findings or [],
        "saved_at": pd.Timestamp.now().isoformat()
    }
    
    SESSION_CONTEXT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SESSION_CONTEXT_PATH.write_text(json.dumps(context, indent=2))
