"""
Code Executor with Reflexion-based Error Correction

Phases:
① Code Cleaning       - Remove markdown, fix formatting
② Execution           - Run in subprocess with timeout
③ Error Diagnosis     - Categorize error type
④ Reflexion           - Generate self-reflection on error
⑤ Code Fix            - Apply reflection to fix code
⑥ Retry               - Max 3 attempts

Error Categories:
- SyntaxError: Code formatting issues
- KeyError/ColumnError: Wrong column names
- DatasetError: Wrong dataset names
- TypeError: Type mismatches
- ValueError: Invalid values
"""

import subprocess
import tempfile
import json
import os
import sys
import re
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum

# Setup paths
_backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_backend_dir.parent))

from llm.groq_client import fast_complete, think_complete

# Setup logger
logger = logging.getLogger("executor")


class ErrorType(Enum):
    """Error categories for targeted reflexion"""
    SYNTAX = "SyntaxError"
    COLUMN = "ColumnNotFound"
    DATASET = "DatasetNotFound"
    TYPE = "TypeError"
    VALUE = "ValueError"
    KEY = "KeyError"
    INDEX = "IndexError"
    MEMORY = "MemoryError"
    IMPORT = "ImportError"
    TIMEOUT = "Timeout"
    EMPTY = "EmptyResult"
    UNKNOWN = "Unknown"


@dataclass
class ExecutionResult:
    """Result of code execution"""
    success: bool
    result: Any
    error: Optional[str]
    code: str
    reflections: List[str]


def categorize_error(error: str) -> ErrorType:
    """Categorize error for targeted fix strategy"""
    e = error.lower()
    
    if "syntaxerror" in e:
        return ErrorType.SYNTAX
    if "keyerror" in e:
        return ErrorType.KEY
    if "indexerror" in e:
        return ErrorType.INDEX
    if "typeerror" in e:
        return ErrorType.TYPE
    if "valueerror" in e:
        return ErrorType.VALUE
    if "memoryerror" in e:
        return ErrorType.MEMORY
    if "importerror" in e or "modulenotfound" in e:
        return ErrorType.IMPORT
    if "timeout" in e:
        return ErrorType.TIMEOUT
    if "column" in e or "not in" in e:
        return ErrorType.COLUMN
    if "dataset" in e and "not found" in e:
        return ErrorType.DATASET
    if "empty" in e or "no data" in e:
        return ErrorType.EMPTY
    
    return ErrorType.UNKNOWN


def clean_code(code: str) -> str:
    """Remove markdown fences and clean up code"""
    if not code:
        return ""
    
    code = code.strip()
    
    # Extract from markdown code block
    match = re.search(r'```(?:python|py)?\s*\n?(.*?)```', code, re.DOTALL | re.IGNORECASE)
    if match:
        code = match.group(1).strip()
    
    # Remove any remaining backticks
    code = re.sub(r'```(?:python|py)?', '', code, flags=re.IGNORECASE)
    code = re.sub(r'```', '', code)
    code = code.strip('`').strip()
    
    # Remove leading "python" text
    lines = code.split('\n')
    while lines and lines[0].strip().lower() in ['python', 'py', '']:
        lines.pop(0)
    
    # Remove any function definitions that redefine our sandbox functions
    cleaned_lines = []
    skip_until_def_ends = False
    for line in lines:
        # Skip if we're inside a function def we want to remove
        if skip_until_def_ends:
            if line and not line[0].isspace() and not line.startswith('#'):
                skip_until_def_ends = False
            else:
                continue
        
        # Check for function definitions we need to skip
        stripped = line.strip()
        if stripped.startswith('def get_full_dataset') or stripped.startswith('def create_chart') or stripped.startswith('def create_table'):
            skip_until_def_ends = True
            continue
        
        # Skip import statements (we provide them in sandbox)
        if stripped.startswith('import ') or stripped.startswith('from '):
            continue
            
        cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines).strip()


def build_sandbox_code(user_code: str, dataset_paths: Dict[str, str]) -> str:
    """Build complete executable code with sandbox setup"""
    
    setup = f'''import pandas as pd
import numpy as np
import json
import warnings
warnings.filterwarnings('ignore')

# Common imports for data analysis
try:
    from scipy import stats
except ImportError:
    pass

try:
    from sklearn.linear_model import LinearRegression
    from sklearn.preprocessing import StandardScaler
except ImportError:
    pass

try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from statsmodels.tsa.arima.model import ARIMA
except ImportError:
    pass

# === DBMS: Dataset Access ===
DATASETS = {json.dumps(dataset_paths)}

def get_full_dataset(name):
    """Load dataset by name"""
    if name not in DATASETS:
        available = list(DATASETS.keys())
        raise ValueError(f"Dataset '{{name}}' not found. Available: {{available}}")
    return pd.read_csv(DATASETS[name], encoding="utf-8-sig")

# Backward-compatible alias used by legacy tests
def load_dataset(name):
    return get_full_dataset(name)
def create_chart(chart_type, title, data, x_key=None, y_keys=None):
    """Create chart for frontend (Recharts format)"""
    # Convert numpy types to native Python types
    clean_data = []
    for row in data:
        clean_row = {{}}
        for k, v in row.items():
            if hasattr(v, 'item'):  # numpy scalar
                clean_row[k] = v.item()
            elif pd.isna(v):
                clean_row[k] = None
            else:
                clean_row[k] = v
        clean_data.append(clean_row)
    chart_obj = {{
        "type": "chart",
        "chartType": chart_type,
        "title": title,
        "data": clean_data,
        "xKey": x_key,
        "yKeys": y_keys or []
    }}
    # Auto-append to RESULT
    RESULT["charts"].append(chart_obj)
    return chart_obj

def create_table(title, data, columns=None):
    """Create table for frontend"""
    # Convert numpy types
    clean_data = []
    for row in data:
        clean_row = {{}}
        for k, v in row.items():
            if hasattr(v, 'item'):
                clean_row[k] = v.item()
            elif pd.isna(v):
                clean_row[k] = None
            else:
                clean_row[k] = v
        clean_data.append(clean_row)
    table_obj = {{
        "type": "table", 
        "title": title,
        "data": clean_data,
        "columns": columns
    }}
    RESULT["tables"].append(table_obj)
    return table_obj

def convert_to_json_safe(obj):
    """Convert numpy/pandas types to JSON-safe Python types"""
    if isinstance(obj, dict):
        return {{k: convert_to_json_safe(v) for k, v in obj.items()}}
    elif isinstance(obj, list):
        return [convert_to_json_safe(v) for v in obj]
    elif hasattr(obj, 'item'):  # numpy scalar
        return obj.item()
    elif pd.isna(obj):
        return None
    else:
        return obj

# Result container
RESULT = {{"data": None, "charts": [], "tables": [], "summary": ""}}

# === USER CODE ===
'''
    
    # Post-process code to ensure proper JSON output
    footer = '''

# Ensure RESULT is JSON serializable
RESULT = convert_to_json_safe(RESULT)
print(json.dumps(RESULT))
'''
    
    # Remove any existing print(json.dumps(RESULT)) from user code to avoid duplicates
    user_code_clean = user_code.replace('print(json.dumps(RESULT))', '').strip()
    
    # Remove any RESULT = {...} redefinitions (LLM sometimes creates new RESULT dict)
    import re
    user_code_clean = re.sub(r'^RESULT\s*=\s*\{[^}]*\}\s*$', '', user_code_clean, flags=re.MULTILINE)
    
    return setup + user_code_clean + footer


def run_subprocess(code: str, timeout: int = 45) -> Tuple[bool, Any, Optional[str]]:
    """Execute code in isolated subprocess"""
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
            f.write(code)
            temp_file = f.name
        
        result = subprocess.run(
            ['python', temp_file],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            # Try to parse JSON output
            try:
                return (True, json.loads(output), None)
            except json.JSONDecodeError:
                # Return raw output if not JSON
                return (True, {"summary": output, "data": output}, None)
        else:
            error = result.stderr or result.stdout or "Unknown error"
            return (False, None, error)
            
    except subprocess.TimeoutExpired:
        return (False, None, f"Execution timeout ({timeout}s)")
    except Exception as e:
        return (False, None, str(e))
    finally:
        if temp_file and os.path.exists(temp_file):
            try:
                os.unlink(temp_file)
            except:
                pass


def generate_reflection(code: str, error: str, error_type: ErrorType, schema_info: str) -> str:
    """Generate self-reflection on the error"""
    
    prompt = f"""You wrote Python code that failed. Analyze the error and explain how to fix it.

ERROR TYPE: {error_type.value}

CODE:
{code[:1500]}

ERROR:
{error[:600]}

AVAILABLE SCHEMA:
{schema_info[:800]}

Write ONE sentence explaining what went wrong and how to fix it.
Example: "Used column 'channel_name' but correct name is 'Channel'. Fix: use 'Channel'."

YOUR REFLECTION:"""

    response = fast_complete([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=150)
    return response.strip()


def fix_code(code: str, error: str, reflection: str, schema_info: str, use_thinking: bool = False) -> str:
    """Fix code using reflection"""
    
    prompt = f"""Fix this Python code based on the error.

FAILED CODE:
{code}

ERROR (truncated):
{error[:400]}

REFLECTION:
{reflection}

AVAILABLE DATASETS (use EXACT names with quotes):
{schema_info}

CRITICAL RULES:
1. DO NOT define get_full_dataset or create_chart - they are already provided!
2. DO NOT add import statements - they are already provided!
3. Just write the code body that uses these functions
4. Use EXACT dataset names in quotes from AVAILABLE DATASETS
5. Use EXACT column names (case-sensitive)
6. Data in charts must be list of dicts with native Python types

OUTPUT ONLY THE FIXED CODE BODY (no imports, no function definitions, no markdown):"""

    if use_thinking:
        response = think_complete([{"role": "user", "content": prompt}], temperature=0.1)
    else:
        response = fast_complete([{"role": "user", "content": prompt}], temperature=0.1)
    
    return clean_code(response)


def execute_code(code: str, description: str = "", max_retries: int = 3) -> ExecutionResult:
    """
    Execute Python code with reflexion-based error correction.
    
    Flow:
    1. Clean code
    2. Execute in sandbox
    3. On error: categorize -> reflect -> fix -> retry
    """
    from dbms import list_datasets, get_schema, get_dataset_path
    
    logger.info("━━━ CODE EXECUTOR ━━━")
    
    # Get dataset info for sandbox and error fixing
    datasets = list_datasets()
    dataset_paths = {}
    schema_info = ""
    
    for ds in datasets:
        name = ds["name"]
        try:
            dataset_paths[name] = get_dataset_path(name)
            schema = get_schema(name)
            cols = [f"{c['col_name']}({c['dtype']})" for c in schema]
            schema_info += f"\n{name}: {', '.join(cols)}"
        except:
            pass
    
    # Clean code
    code = clean_code(code)
    original_code = code
    reflections = []
    last_error = None
    
    # Log code preview
    code_lines = code.split('\n')
    logger.debug(f"Code ({len(code)} chars, {len(code_lines)} lines):")
    for line in code_lines[:5]:
        logger.debug(f"  {line[:80]}")
    if len(code_lines) > 5:
        logger.debug(f"  ... ({len(code_lines) - 5} more lines)")
    
    for attempt in range(max_retries):
        logger.info(f"Attempt {attempt + 1}/{max_retries}")
        
        # Build and run sandboxed code
        full_code = build_sandbox_code(code, dataset_paths)
        success, result, error = run_subprocess(full_code)
        
        if success:
            logger.info("✓ Execution successful")
            if isinstance(result, dict):
                logger.info(f"  Summary: {result.get('summary', 'N/A')[:80]}")
                logger.info(f"  Charts: {len(result.get('charts', []))}")
            return ExecutionResult(
                success=True,
                result=result,
                error=None,
                code=code,
                reflections=reflections
            )
        
        last_error = error
        # Log only first 100 chars of error
        error_preview = error[:100].replace('\n', ' ') if error else 'Unknown'
        logger.warning(f"✗ Failed: {error_preview}...")
        
        # Reflexion loop
        if attempt < max_retries - 1:
            error_type = categorize_error(error)
            logger.info(f"Error type: {error_type.value}")
            
            # Generate reflection
            logger.info("Generating reflection...")
            reflection = generate_reflection(code, error, error_type, schema_info)
            reflections.append(reflection)
            logger.info(f"Reflection: {reflection[:100]}...")
            
            # Fix code
            use_thinking = attempt >= 1
            logger.info(f"Fixing code (thinking={use_thinking})...")
            code = fix_code(code, error, reflection, schema_info, use_thinking)
            logger.info(f"Fixed code: {len(code)} chars")
    
    logger.error(f"All {max_retries} attempts failed")
    return ExecutionResult(
        success=False,
        result=None,
        error=last_error,
        code=code,
        reflections=reflections
    )


def execute_code_with_retry(code: str, description: str = "", max_retries: int = 3) -> dict:
    """Legacy wrapper for execute_code"""
    result = execute_code(code, description, max_retries)
    return {
        "success": result.success,
        "result": result.result,
        "error": result.error,
        "code": result.code,
        "reflections": result.reflections
    }
