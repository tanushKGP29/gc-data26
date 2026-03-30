"""
Script Executor — Safely runs saved analytics Python scripts.
Used by analytics_engine to execute KPI and chart data scripts.
"""
import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger("analytics.script_executor")

SAVED_DIR = Path(__file__).parent.parent.parent / "data" / "saved_analytics"
TIMEOUT = 90  # seconds


def execute_script(script_name: str) -> Dict[str, Any]:
    """
    Execute a saved analytics script in a subprocess.

    Returns:
        {"success": bool, "output": str, "error": str}
    """
    script_path = SAVED_DIR / script_name

    if not script_path.exists():
        return {"success": False, "output": "", "error": f"Script not found: {script_path}"}

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            cwd=str(SAVED_DIR)
        )

        if result.returncode == 0:
            logger.info(f"Script {script_name} executed successfully")
            return {
                "success": True,
                "output": result.stdout,
                "error": ""
            }
        else:
            logger.error(f"Script {script_name} failed: {result.stderr}")
            return {
                "success": False,
                "output": result.stdout,
                "error": result.stderr
            }

    except subprocess.TimeoutExpired:
        logger.error(f"Script {script_name} timed out after {TIMEOUT}s")
        return {"success": False, "output": "", "error": f"Timeout after {TIMEOUT}s"}
    except Exception as e:
        logger.error(f"Script execution error: {e}")
        return {"success": False, "output": "", "error": str(e)}


def execute_kpi_script() -> Optional[list]:
    """Execute kpi_script.py and parse the JSON output."""
    result = execute_script("kpi_script.py")
    if result["success"] and result["output"].strip():
        try:
            return json.loads(result["output"])
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse KPI script output: {e}")
            return None
    elif not result["success"]:
        logger.error(f"KPI script failed: {result['error']}")
    return None


def execute_chart_data_script() -> Optional[dict]:
    """Execute chart_data_script.py and return success status."""
    result = execute_script("chart_data_script.py")
    if result["success"]:
        return {"success": True}
    else:
        logger.error(f"Chart data script failed: {result['error']}")
        return None


def scripts_exist() -> bool:
    """Check if saved scripts exist."""
    kpi = SAVED_DIR / "kpi_script.py"
    chart = SAVED_DIR / "chart_data_script.py"
    return kpi.exists() and chart.exists()
