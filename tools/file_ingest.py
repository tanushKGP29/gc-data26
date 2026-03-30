"""
File Ingest Tool - Handles uploading and registering new datasets.
Supports CSV, JSON, Excel files.
"""
import os
import sys
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Any
import pandas as pd

# Get paths without importing config
_tools_dir = Path(__file__).parent
_agent_dir = _tools_dir.parent
_project_dir = _agent_dir.parent
DATA_DIR = os.getenv("FRAMMER_DATA_DIR", str(_project_dir))
SUPPORTED_DATA_EXTENSIONS = [".csv", ".json", ".xlsx", ".xls"]

# Lazy import for registry
def _get_registry():
    try:
        backend_dir = _agent_dir / "backend"
        sys.path.insert(0, str(backend_dir))
        from context_manager import get_registry
        return get_registry()
    except Exception:
        return None


def ingest_file(
    file_path: str,
    name: Optional[str] = None,
    tags: Optional[List[str]] = None,
    copy_to_data_dir: bool = True
) -> Dict[str, Any]:
    """
    Ingest a new data file into the system.
    
    Args:
        file_path: Path to the file to ingest
        name: Optional custom name for the dataset
        tags: Optional domain tags
        copy_to_data_dir: Whether to copy file to data directory
    
    Returns:
        Dictionary with dataset info and status
    """
    path = Path(file_path)
    
    # Validate file exists
    if not path.exists():
        return {"success": False, "error": f"File not found: {file_path}"}
    
    # Validate extension
    if path.suffix.lower() not in SUPPORTED_DATA_EXTENSIONS:
        return {
            "success": False,
            "error": f"Unsupported file type: {path.suffix}. Supported: {SUPPORTED_DATA_EXTENSIONS}"
        }
    
    # Validate file can be read
    try:
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path, nrows=5)
        elif path.suffix.lower() == ".json":
            df = pd.read_json(path)
        elif path.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(path, nrows=5)
        else:
            return {"success": False, "error": f"Cannot read file type: {path.suffix}"}
    except Exception as e:
        return {"success": False, "error": f"Failed to read file: {str(e)}"}
    
    # Copy to data directory if requested
    if copy_to_data_dir:
        dest_dir = _agent_dir / "data" / "uploads"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / path.name
        
        # Handle name conflicts
        counter = 1
        while dest_path.exists():
            dest_path = dest_dir / f"{path.stem}_{counter}{path.suffix}"
            counter += 1
        
        shutil.copy2(path, dest_path)
        file_path = str(dest_path)
    
    # Register in database
    registry = _get_registry()
    if not registry:
        return {"success": False, "error": "Registry not available"}
    
    try:
        dataset_id = registry.register_dataset(
            file_path=file_path,
            name=name or path.stem,
            domain_tags=tags
        )
        
        # Update semantic index
        try:
            backend_dir = _agent_dir / "backend"
            sys.path.insert(0, str(backend_dir))
            from context_manager import get_retrieval
            retrieval = get_retrieval()
            retrieval.index_datasets()
        except Exception:
            pass  # Non-critical
        
        # Get dataset info
        dataset = registry.get_dataset(dataset_id)
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "name": dataset["name"],
            "rows": dataset["row_count"],
            "columns": dataset["col_count"],
            "description": dataset["description"]
        }
        
    except Exception as e:
        return {"success": False, "error": f"Failed to register dataset: {str(e)}"}


def ingest_uploaded_bytes(
    content: bytes,
    filename: str,
    name: Optional[str] = None,
    tags: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Ingest file content uploaded as bytes (from API).
    
    Args:
        content: File content as bytes
        filename: Original filename
        name: Optional custom name
        tags: Optional domain tags
    
    Returns:
        Dictionary with dataset info and status
    """
    # Save to temp location
    dest_dir = AGENT_DIR / "data" / "uploads"
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    dest_path = dest_dir / filename
    
    # Handle name conflicts
    counter = 1
    while dest_path.exists():
        stem = Path(filename).stem
        suffix = Path(filename).suffix
        dest_path = dest_dir / f"{stem}_{counter}{suffix}"
        counter += 1
    
    # Write file
    dest_path.write_bytes(content)
    
    # Ingest
    return ingest_file(str(dest_path), name=name, tags=tags, copy_to_data_dir=False)


def list_supported_formats() -> List[str]:
    """Return list of supported file formats."""
    return SUPPORTED_DATA_EXTENSIONS.copy()


def validate_file(file_path: str) -> Dict[str, Any]:
    """
    Validate a file without ingesting it.
    
    Returns:
        Validation result with preview info
    """
    path = Path(file_path)
    
    if not path.exists():
        return {"valid": False, "error": "File not found"}
    
    if path.suffix.lower() not in SUPPORTED_DATA_EXTENSIONS:
        return {"valid": False, "error": f"Unsupported format: {path.suffix}"}
    
    try:
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path, nrows=10)
        elif path.suffix.lower() == ".json":
            df = pd.read_json(path)
            df = df.head(10)
        elif path.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(path, nrows=10)
        else:
            return {"valid": False, "error": "Cannot read file"}
        
        return {
            "valid": True,
            "rows_preview": len(df),
            "columns": list(df.columns),
            "dtypes": {col: str(df[col].dtype) for col in df.columns},
            "sample": df.head(3).to_dict(orient="records")
        }
        
    except Exception as e:
        return {"valid": False, "error": str(e)}
