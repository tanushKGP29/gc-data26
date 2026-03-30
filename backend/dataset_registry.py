"""
Simple in-memory dataset registry.

Loads datasets from dataset_paths.json (the same role→file mapping that the
analytics dashboard uses) so the chat agent always sees the same data as the UI.
Falls back to scanning data/datasets/ if dataset_paths.json doesn't exist yet.
"""
import os
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional
import json
# base_dir = Path(__file__).resolve().parent
_backend_dir = Path(__file__).resolve().parent
_agent_dir = _backend_dir.parent if _backend_dir.name == "backend" else _backend_dir

DATASET_PATHS_JSON = _agent_dir / "data" / "saved_analytics" / "dataset_paths.json"
DATASETS_DIR = _agent_dir / "data" / "datasets"


def _find_merged_dir() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "merged"
        if candidate.exists():
            return candidate
    return _agent_dir / "data" / "merged"

def hello():
    print("Hello from dataset_registry.py!")
class DatasetRegistry:
    def __init__(self, data_dir: str = ""):
        self.data_dir = Path(data_dir) if data_dir else DATASETS_DIR
        self.datasets: Dict[str, dict] = {}
        self._load_all()

    def _load_all(self):
        """Load datasets from dataset_paths.json (shared with dashboard).
        Falls back to directory scan if the JSON doesn't exist yet."""
        paths: Dict[str, str] = {}

        # Prefer dataset_paths.json — this is the single source of truth
        if DATASET_PATHS_JSON.exists():
            try:
                paths = json.loads(DATASET_PATHS_JSON.read_text(encoding="utf-8"))
                print(f"[registry] Loading from dataset_paths.json ({len(paths)} roles)")
            except Exception:
                paths = {}

        # Fallback: scan directory
        if not paths:
            print(f"[registry] Falling back to directory scan: {self.data_dir}")
            for filepath in sorted(self.data_dir.glob("*.csv")):
                paths[filepath.stem] = str(filepath)

        self.datasets = {}
        merged_dir = _find_merged_dir()
        for name, filepath_str in paths.items():
            filepath = Path(filepath_str)
            if not filepath.exists():
                # Try resolving by filename inside known data folders
                alt = merged_dir / filepath.name
                if alt.exists():
                    filepath = alt
                else:
                    alt = self.data_dir / filepath.name
                    if alt.exists():
                        filepath = alt
                    else:
                        print(f"  [!] {name}: file not found ({filepath.name})")
                        continue
            try:
                df = pd.read_csv(filepath, encoding="utf-8-sig")
                self.datasets[name] = {
                    "name": name,
                    "path": str(filepath.absolute()),
                    "rows": len(df),
                    "columns": df.columns.tolist(),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "sample": df.head(3).to_dict("records"),
                    "sample_rows": df.head(3).to_dict("records"),
                    "null_counts": df.isnull().sum().to_dict(),
                }
                print(f"  + {name}: {len(df)} rows, {len(df.columns)} columns")
            except Exception as e:
                print(f"  x Failed to load {name}: {e}")

        # Also scan merged directory to add any missing datasets
        scan_dir = merged_dir if merged_dir.exists() else self.data_dir
        for filepath in sorted(scan_dir.glob("*.csv")):
            name = filepath.stem
            if name in self.datasets:
                continue
            try:
                df = pd.read_csv(filepath, encoding="utf-8-sig")
                self.datasets[name] = {
                    "name": name,
                    "path": str(filepath.absolute()),
                    "rows": len(df),
                    "columns": df.columns.tolist(),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "sample": df.head(3).to_dict("records"),
                    "sample_rows": df.head(3).to_dict("records"),
                    "null_counts": df.isnull().sum().to_dict(),
                }
            except Exception as e:
                print(f"  x Failed to load {name}: {e}")

        print(f"[registry] Loaded {len(self.datasets)} datasets")

    def reload(self):
        """Re-read dataset_paths.json and refresh in-memory state.
        Call this after analytics pipeline runs, upload, delete, or mode switch."""
        self._load_all()

    def load_from_paths(self, dataset_paths: Dict[str, str]):
        """Load from an explicit role→filepath dict (e.g. standalone upload)."""
        self.datasets = {}
        for name, filepath_str in dataset_paths.items():
            filepath = Path(filepath_str)
            if not filepath.exists():
                continue
            try:
                df = pd.read_csv(filepath, encoding="utf-8-sig")
                self.datasets[name] = {
                    "name": name,
                    "path": str(filepath.absolute()),
                    "rows": len(df),
                    "columns": df.columns.tolist(),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "sample": df.head(3).to_dict("records"),
                    "sample_rows": df.head(3).to_dict("records"),
                    "null_counts": df.isnull().sum().to_dict(),
                }
            except Exception:
                pass
        print(f"[registry] Reloaded with {len(self.datasets)} datasets (explicit paths)")

    def list_datasets(self) -> List[str]:
        """Return list of dataset names"""
        return list(self.datasets.keys())

    def get_summary(self) -> str:
        """Get lightweight summary of all datasets for LLM context"""
        summary = "Available Datasets:\n\n"
        for name, meta in self.datasets.items():
            summary += f"**{name}**\n"
            summary += f"  - Rows: {meta['rows']}\n"
            summary += f"  - Columns: {', '.join(meta['columns'])}\n\n"
        return summary

    def _resolve_name(self, name: str) -> Optional[str]:
        """Resolve dataset name, handling a few legacy aliases."""
        if name in self.datasets:
            return name

        # Legacy naming: monthly-chart -> monthly
        if name.endswith("-chart"):
            alt = name.removesuffix("-chart")
            if alt in self.datasets:
                return alt

        # Dashes vs underscores
        alt = name.replace("-", "_")
        if alt in self.datasets:
            return alt

        if name == "channel-wise-publishing" and "channel_summary" in self.datasets:
            return "channel_summary"

        return None

    def get_dataset_details(self, name: str) -> Optional[dict]:
        """Get full metadata for a specific dataset."""
        resolved = self._resolve_name(name)
        return self.datasets.get(resolved) if resolved else None

    def get_dataset_path(self, name: str) -> Optional[str]:
        """Get file path for a dataset."""
        resolved = self._resolve_name(name)
        meta = self.datasets.get(resolved) if resolved else None
        return meta["path"] if meta else None

    def to_json(self) -> str:
        """Export registry as JSON for LLM"""
        return json.dumps(self.datasets, indent=2)


# Global registry instance
_registry: Optional[DatasetRegistry] = None


def initialize_registry(data_dir: str = "") -> DatasetRegistry:
    global _registry
    _registry = DatasetRegistry(data_dir)
    return _registry


def get_registry() -> DatasetRegistry:
    global _registry
    if _registry is None:
        _registry = DatasetRegistry()
    return _registry
