"""
Dataset Registry - SQLite-based registry for dataset metadata and schemas.
Fully dataset-agnostic: no hardcoded column names or domain assumptions.
"""
import os
import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
import pandas as pd
import numpy as np

import sys
_backend_dir = Path(__file__).parent.parent
_root_dir = _backend_dir.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_root_dir))

from config import SQLITE_DB_PATH, DATA_DIR, SUPPORTED_DATA_EXTENSIONS
from llm.groq_client import fast_complete


class DatasetRegistry:
    """SQLite-based registry for dataset metadata and profiling results."""
    
    def __init__(self, db_path: Path = SQLITE_DB_PATH):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """Initialize database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Datasets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                row_count INTEGER,
                col_count INTEGER,
                description TEXT,
                domain_tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Columns table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS columns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                dtype TEXT,
                null_rate REAL,
                distinct_count INTEGER,
                top_values TEXT,
                description TEXT,
                semantic_type TEXT,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id),
                UNIQUE(dataset_id, name)
            )
        """)
        
        # KPIs/Metrics table for pre-computed values
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                value REAL,
                formatted_value TEXT,
                category TEXT,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
    
    def _get_conn(self) -> sqlite3.Connection:
        """Get database connection."""
        return sqlite3.connect(self.db_path)
    
    # ─── Dataset Operations ──────────────────────────────────────────────────
    
    def register_dataset(
        self,
        file_path: str,
        name: Optional[str] = None,
        domain_tags: Optional[List[str]] = None
    ) -> int:
        """
        Register a new dataset and profile it.
        Returns dataset ID.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        name = name or path.stem
        file_type = path.suffix.lower()
        
        # Load and profile the dataset
        df = self._load_dataframe(path)
        row_count, col_count = df.shape
        
        # Generate description using LLM
        description = self._generate_description(name, df)
        
        conn = self._get_conn()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO datasets 
                (name, file_path, file_type, row_count, col_count, description, domain_tags, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                name, str(path), file_type, row_count, col_count,
                description, json.dumps(domain_tags or []), datetime.now()
            ))
            dataset_id = cursor.lastrowid
            
            # Profile columns
            self._profile_columns(cursor, dataset_id, df)
            
            conn.commit()
            return dataset_id
        finally:
            conn.close()
    
    def _load_dataframe(self, path: Path) -> pd.DataFrame:
        """Load dataframe from file."""
        suffix = path.suffix.lower()
        if suffix == ".csv":
            return pd.read_csv(path, encoding="utf-8-sig", nrows=10000)
        elif suffix == ".json":
            return pd.read_json(path)
        elif suffix in [".xlsx", ".xls"]:
            return pd.read_excel(path)
        else:
            raise ValueError(f"Unsupported file type: {suffix}")
    
    def _profile_columns(self, cursor: sqlite3.Cursor, dataset_id: int, df: pd.DataFrame):
        """Profile all columns in a dataframe."""
        for col in df.columns:
            series = df[col]
            
            # Compute statistics
            null_rate = series.isna().mean()
            distinct_count = series.nunique()
            
            # Get top values for categorical columns
            top_values = []
            if distinct_count <= 50 or series.dtype == 'object':
                try:
                    top_values = series.value_counts().head(10).index.tolist()
                    top_values = [str(v) for v in top_values if pd.notna(v)]
                except:
                    pass
            
            # Infer semantic type
            semantic_type = self._infer_semantic_type(col, series)
            
            cursor.execute("""
                INSERT OR REPLACE INTO columns
                (dataset_id, name, dtype, null_rate, distinct_count, top_values, semantic_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                dataset_id, col, str(series.dtype), null_rate,
                distinct_count, json.dumps(top_values), semantic_type
            ))
    
    def _infer_semantic_type(self, col_name: str, series: pd.Series) -> str:
        """Infer semantic type from column name and values."""
        col_lower = col_name.lower()
        
        # Check for common patterns
        if any(x in col_lower for x in ['id', 'key', 'code']):
            return 'identifier'
        if any(x in col_lower for x in ['date', 'time', 'timestamp', 'month', 'year']):
            return 'temporal'
        if any(x in col_lower for x in ['count', 'total', 'sum', 'amount', 'quantity']):
            return 'metric'
        if any(x in col_lower for x in ['rate', 'ratio', 'percent', 'pct', '%']):
            return 'percentage'
        if any(x in col_lower for x in ['duration', 'length', 'time']):
            return 'duration'
        if any(x in col_lower for x in ['name', 'title', 'label']):
            return 'categorical'
        if series.dtype in ['int64', 'float64']:
            return 'numeric'
        if series.dtype == 'object':
            return 'text'
        return 'unknown'
    
    def _generate_description(self, name: str, df: pd.DataFrame) -> str:
        """Generate natural language description using LLM."""
        try:
            sample = df.head(3).to_string()
            columns = list(df.columns)
            
            prompt = f"""Describe this dataset in 1-2 sentences for a data analyst.
Dataset name: {name}
Columns: {columns}
Sample rows:
{sample}

Provide a brief, factual description of what this data contains."""
            
            return fast_complete(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a data analyst. Provide concise dataset descriptions.",
                temperature=0.3,
                max_tokens=150
            )
        except Exception as e:
            return f"Dataset with {len(df.columns)} columns and {len(df)} rows"
    
    def clear_all_datasets(self) -> None:
        """Remove all rows from datasets and columns tables.
        Used when switching between standalone/main mode so the chat agent
        only sees datasets that match the active dashboard."""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM columns")
        cursor.execute("DELETE FROM datasets")
        cursor.execute("DELETE FROM metrics")
        conn.commit()
        conn.close()

    # ─── Query Operations ────────────────────────────────────────────────────
    
    def list_datasets(self) -> List[Dict[str, Any]]:
        """List all registered datasets."""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, file_path, file_type, row_count, col_count, description, domain_tags
            FROM datasets ORDER BY name
        """)
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "name": row[1],
                "file_path": row[2],
                "file_type": row[3],
                "row_count": row[4],
                "col_count": row[5],
                "description": row[6],
                "domain_tags": json.loads(row[7]) if row[7] else []
            })
        
        conn.close()
        return results
    
    def get_dataset(self, dataset_id: int) -> Optional[Dict[str, Any]]:
        """Get dataset metadata and schema."""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, file_path, file_type, row_count, col_count, description
            FROM datasets WHERE id = ?
        """, (dataset_id,))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        
        dataset = {
            "id": row[0],
            "name": row[1],
            "file_path": row[2],
            "file_type": row[3],
            "row_count": row[4],
            "col_count": row[5],
            "description": row[6],
            "columns": []
        }
        
        cursor.execute("""
            SELECT name, dtype, null_rate, distinct_count, top_values, description, semantic_type
            FROM columns WHERE dataset_id = ?
        """, (dataset_id,))
        
        for col_row in cursor.fetchall():
            dataset["columns"].append({
                "name": col_row[0],
                "dtype": col_row[1],
                "null_rate": col_row[2],
                "distinct_count": col_row[3],
                "top_values": json.loads(col_row[4]) if col_row[4] else [],
                "description": col_row[5],
                "semantic_type": col_row[6]
            })
        
        conn.close()
        return dataset
    
    def get_dataset_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get dataset by name."""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM datasets WHERE name = ?", (name,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self.get_dataset(row[0])
        return None
    
    def get_sample(
        self,
        dataset_id: int,
        columns: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> pd.DataFrame:
        """Get sample rows from a dataset."""
        dataset = self.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        df = self._load_dataframe(Path(dataset["file_path"]))
        
        # Apply column selection
        if columns:
            df = df[[c for c in columns if c in df.columns]]
        
        # Apply filters
        if filters:
            for col, value in filters.items():
                if col in df.columns:
                    df = df[df[col] == value]
        
        return df.head(limit)
    
    def get_full_data(self, dataset_id: int) -> pd.DataFrame:
        """Load full dataset for code execution."""
        dataset = self.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        return pd.read_csv(dataset["file_path"], encoding="utf-8-sig")
    
    # ─── Metrics Operations ──────────────────────────────────────────────────
    
    def save_metric(self, name: str, value: float, formatted: str = "", category: str = "", description: str = ""):
        """Save a computed metric/KPI."""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO metrics (name, value, formatted_value, category, description, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, value, formatted, category, description, datetime.now()))
        conn.commit()
        conn.close()
    
    def get_metrics(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all saved metrics, optionally filtered by category."""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        if category:
            cursor.execute("SELECT name, value, formatted_value, category, description FROM metrics WHERE category = ?", (category,))
        else:
            cursor.execute("SELECT name, value, formatted_value, category, description FROM metrics")
        
        results = [
            {"name": r[0], "value": r[1], "formatted": r[2], "category": r[3], "description": r[4]}
            for r in cursor.fetchall()
        ]
        conn.close()
        return results
    
    # ─── Schema Summary for LLM ──────────────────────────────────────────────
    
    def get_schema_summary(self) -> str:
        """Generate a natural language summary of all datasets for LLM context."""
        datasets = self.list_datasets()
        if not datasets:
            return "No datasets registered."
        
        lines = ["## Available Datasets\n"]
        for ds in datasets:
            full_ds = self.get_dataset(ds["id"])
            lines.append(f"### {ds['name']}")
            lines.append(f"- Rows: {ds['row_count']}, Columns: {ds['col_count']}")
            lines.append(f"- Description: {ds['description']}")
            if full_ds and full_ds.get("columns"):
                col_info = ", ".join([f"{c['name']} ({c['semantic_type']})" for c in full_ds["columns"][:10]])
                if len(full_ds["columns"]) > 10:
                    col_info += f", ... ({len(full_ds['columns']) - 10} more)"
                lines.append(f"- Columns: {col_info}")
            lines.append("")
        
        return "\n".join(lines)


# ─── Singleton Instance ──────────────────────────────────────────────────────
_registry: Optional[DatasetRegistry] = None

def get_registry() -> DatasetRegistry:
    """Get or create the singleton registry instance."""
    global _registry
    if _registry is None:
        _registry = DatasetRegistry()
    return _registry
