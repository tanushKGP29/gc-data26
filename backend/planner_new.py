"""
Planning Agent with Conditional Phases (LLM-Based)

Phase Architecture:
① Task Understanding     - LLM classifies intent, identifies datasets/KPIs needed
② Data Planning          - Identify datasets/columns needed  
③ Approach Planning      - For complex tasks: Plan multi-step analysis
④ Code Generation        - Generate analysis code (NO chart code - delegate to plotting agent)
⑤ Code Execution         - Execute with reflexion loop

Tools Available:
- DBMS: list_datasets, get_schema, get_first_rows, get_full_dataset
- KPI: list_kpis, get_kpi_details, compute_kpi (use ONLY when explicit KPI calculation needed)
"""
import json
import re
import sys
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

# Setup paths
_backend_dir = Path(__file__).parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_backend_dir.parent))

from llm.groq_client import think_complete, fast_complete
from dbms import list_datasets, get_schema, get_first_rows, get_datasets_context

# Setup logger
logger = logging.getLogger("planner")


# ═══════════════════════════════════════════════════════════════════════════════
# KPI TOOLS - Available for planner when KPI computation is explicitly needed
# ═══════════════════════════════════════════════════════════════════════════════

_KPI_REGISTRY_PATH = _backend_dir / "analytics" / "kpi_registry.json"
_DATASET_PATHS = _backend_dir.parent / "data" / "saved_analytics" / "dataset_paths.json"


def list_kpis() -> List[Dict[str, str]]:
    """List all available KPIs with metadata."""
    try:
        registry = json.loads(_KPI_REGISTRY_PATH.read_text(encoding="utf-8"))
        items = []
        for kpi in registry.get("kpis", []):
            items.append({
                "id": kpi.get("id", ""),
                "name": kpi.get("name", ""),
                "description": kpi.get("description", ""),
                "category": kpi.get("category", ""),
                "formula": kpi.get("formula", ""),
                "datasets_required": kpi.get("input", {}).get("datasets", []),
            })
        return items
    except Exception as e:
        logger.error(f"Failed to load KPI registry: {e}")
        return []


def get_kpi_details(kpi_id: str) -> Optional[Dict[str, Any]]:
    """Get detailed information about a specific KPI."""
    try:
        registry = json.loads(_KPI_REGISTRY_PATH.read_text(encoding="utf-8"))
        for kpi in registry.get("kpis", []):
            if kpi.get("id") == kpi_id:
                return kpi
        return None
    except Exception as e:
        logger.error(f"Failed to get KPI details: {e}")
        return None


def compute_kpi(kpi_id: str) -> Optional[Dict[str, Any]]:
    """Compute a specific KPI and return its result."""
    try:
        from analytics.kpi_executor import KPIExecutor
        
        dataset_paths = {}
        if _DATASET_PATHS.exists():
            dataset_paths = json.loads(_DATASET_PATHS.read_text(encoding="utf-8"))
        
        executor = KPIExecutor()
        executor.set_dataset_paths(dataset_paths)
        return executor.compute_kpi_by_id(kpi_id)
    except Exception as e:
        logger.error(f"Failed to compute KPI {kpi_id}: {e}")
        return None


def get_kpis_summary() -> str:
    """Get a brief summary of available KPIs for LLM context."""
    kpis = list_kpis()
    if not kpis:
        return "No KPIs available."
    
    lines = []
    for k in kpis[:15]:  # Limit to avoid token bloat
        lines.append(f"- {k['id']}: {k['name']} ({k['description']})")
    
    if len(kpis) > 15:
        lines.append(f"... and {len(kpis) - 15} more KPIs")
    
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# TASK PLANNING STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════════

class TaskType(Enum):
    GREETING = "greeting"
    LIST_DATA = "list_data"
    DESCRIBE_DATA = "describe_data"
    KPI_LOOKUP = "kpi_lookup"
    ANALYSIS = "analysis"
    VISUALIZATION = "visualization"


@dataclass
class TaskPlan:
    """Result of task understanding phase"""
    task_type: TaskType
    intent: str
    needs_code: bool
    needs_visualization: bool
    datasets_needed: List[str]
    kpis_to_compute: List[str]
    columns_needed: Dict[str, List[str]]


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: LLM-BASED TASK UNDERSTANDING
# ═══════════════════════════════════════════════════════════════════════════════

def understand_task(query: str, conversation_context: str = "") -> TaskPlan:
    """
    Phase 1: Task Understanding (LLM-based, no keyword matching)
    
    The LLM decides what type of task this is and what resources are needed.
    """
    logger.info("━━━ PHASE 1: Task Understanding ━━━")
    
    # Get available context
    datasets = list_datasets()
    dataset_info = "\n".join([
        f"- {d['name']}: {d['row_count']} rows, columns: {', '.join(d['columns'][:8])}"
        for d in datasets
    ])
    
    kpi_info = get_kpis_summary()
    
    # Build context section
    context_section = ""
    if conversation_context:
        context_section = f"""
RECENT CONVERSATION:
{conversation_context}

Note: User may refer to previous results. Resolve pronouns like "it", "that", "same" using this context.
"""
    
    prompt = f"""You are a data analysis assistant. Analyze this user request and determine what's needed.
{context_section}
USER REQUEST: "{query}"

AVAILABLE DATASETS:
{dataset_info}

AVAILABLE KPIs (pre-computed metrics):
{kpi_info}

TASK CLASSIFICATION GUIDE WITH EXAMPLES:

1. GREETING - User is saying hello or asking what you can do
   Examples: "hi", "hello", "what can you do?", "help me"
   
2. LIST_DATA - User wants to see what datasets are available
   Examples: "what data do you have?", "show me the datasets", "list tables"
   
3. DESCRIBE_DATA - User wants schema/details of a specific dataset
   Examples: "describe channel_summary", "what columns are in user_summary?", "show schema for monthly"
   
4. KPI_LOOKUP - User is asking for a specific pre-computed metric value
   Examples: "what's the publish rate?", "total uploaded count", "show me the amplification ratio"
   → Use this ONLY when asking for a single KPI value that exists in the KPI list
   
5. ANALYSIS - User wants custom analysis, computation, comparison, or filtering
   Examples: "top 5 users by video count", "compare channels", "which month had highest uploads?"
   → This requires CODE to compute results
   
6. VISUALIZATION - User explicitly wants a chart/graph/plot
   Examples: "plot monthly trends", "show me a bar chart of channels", "visualize the funnel"
   → This requires both CODE and VISUALIZATION

IMPORTANT RULES:
- If user asks for a KPI that EXISTS in the KPI list → KPI_LOOKUP
- If user asks for analysis/ranking/comparison/filtering → ANALYSIS  
- If user explicitly mentions chart/plot/graph/visualize → VISUALIZATION
- When in doubt between KPI_LOOKUP and ANALYSIS, prefer ANALYSIS (more flexible)

Respond with JSON only:
{{
    "task_type": "greeting|list_data|describe_data|kpi_lookup|analysis|visualization",
    "intent": "brief description of what user wants",
    "needs_code": true/false,
    "needs_visualization": true/false,
    "datasets_needed": ["dataset_name"],
    "kpis_to_compute": ["kpi_id"],
    "target_dataset": "dataset_name if describe_data",
    "reasoning": "why you chose this classification"
}}"""

    logger.debug("Calling LLM for task understanding...")
    response = fast_complete([{"role": "user", "content": prompt}], temperature=0.1)
    logger.debug(f"LLM response: {response[:300]}...")
    
    try:
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            data = json.loads(match.group())
            
            task_type_str = data.get("task_type", "analysis").lower()
            task_type_map = {
                "greeting": TaskType.GREETING,
                "list_data": TaskType.LIST_DATA,
                "describe_data": TaskType.DESCRIBE_DATA,
                "kpi_lookup": TaskType.KPI_LOOKUP,
                "analysis": TaskType.ANALYSIS,
                "visualization": TaskType.VISUALIZATION,
            }
            task_type = task_type_map.get(task_type_str, TaskType.ANALYSIS)
            
            plan = TaskPlan(
                task_type=task_type,
                intent=data.get("intent", query),
                needs_code=data.get("needs_code", False),
                needs_visualization=data.get("needs_visualization", False),
                datasets_needed=data.get("datasets_needed", []),
                kpis_to_compute=data.get("kpis_to_compute", []),
                columns_needed={},
            )
            
            # Store target_dataset for describe_data
            if task_type == TaskType.DESCRIBE_DATA:
                plan.columns_needed["_target"] = [data.get("target_dataset", "")]
            
            logger.info(f"Task Type: {plan.task_type.value}")
            logger.info(f"Intent: {plan.intent}")
            logger.info(f"Reasoning: {data.get('reasoning', 'N/A')}")
            
            return plan
    except Exception as e:
        logger.warning(f"Failed to parse LLM response: {e}")
    
    # Fallback to analysis
    logger.info("Fallback to ANALYSIS task type")
    return TaskPlan(
        task_type=TaskType.ANALYSIS,
        intent=query,
        needs_code=True,
        needs_visualization=False,
        datasets_needed=[],
        kpis_to_compute=[],
        columns_needed={},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# SIMPLE TASK HANDLERS
# ═══════════════════════════════════════════════════════════════════════════════

def handle_greeting(query: str) -> dict:
    """Handle greeting/help queries."""
    logger.info("━━━ GREETING HANDLER ━━━")
    datasets = list_datasets()
    dataset_names = [d["name"] for d in datasets]
    
    prompt = f"""You are a data analysis assistant for Frammer AI (media publishing platform).

User: "{query}"

Respond briefly and naturally. Mention you can help analyze their video publishing data.
Available datasets: {', '.join(dataset_names[:5])}

Keep under 80 words."""

    response = fast_complete([{"role": "user", "content": prompt}], temperature=0.7)
    return {"answer": response.strip(), "artifacts": [], "reasoning": []}


def handle_list_data() -> dict:
    """Handle dataset listing queries."""
    logger.info("━━━ LIST DATA HANDLER ━━━")
    datasets = list_datasets()
    
    answer = "Here are the available datasets:\n\n"
    for ds in datasets:
        answer += f"• **{ds['name']}** - {ds['row_count']} rows, {ds['col_count']} columns\n"
        answer += f"  Columns: {', '.join(ds['columns'][:6])}{'...' if len(ds['columns']) > 6 else ''}\n\n"
    
    return {"answer": answer, "artifacts": [], "reasoning": []}


def handle_describe_data(task_plan: TaskPlan) -> dict:
    """Handle dataset description queries."""
    logger.info("━━━ DESCRIBE DATA HANDLER ━━━")
    
    # Get target dataset from task plan
    target = task_plan.columns_needed.get("_target", [""])[0]
    
    if not target:
        datasets = list_datasets()
        dataset_names = [d["name"] for d in datasets]
        return {
            "answer": f"Which dataset would you like to know about? Available: {', '.join(dataset_names[:8])}",
            "artifacts": [],
            "reasoning": []
        }
    
    try:
        schema = get_schema(target)
        first_rows = get_first_rows(target, 3)
        
        answer = f"**Dataset: {target}**\n\n"
        answer += "| Column | Type | Null% | Sample Values |\n"
        answer += "|--------|------|-------|---------------|\n"
        for col in schema:
            samples = str(col['sample_values'][:2]) if col['sample_values'] else "[]"
            answer += f"| {col['col_name']} | {col['dtype']} | {col['null_pct']}% | {samples[:30]} |\n"
        
        answer += f"\n**Preview (first 3 rows):**\n```\n{first_rows.to_string(index=False)}\n```"
        
        return {"answer": answer, "artifacts": [], "reasoning": []}
    except Exception as e:
        return {"answer": f"Error getting schema: {e}", "artifacts": [], "reasoning": []}


def handle_kpi_lookup(task_plan: TaskPlan) -> dict:
    """Handle KPI lookup queries - compute and return KPI values."""
    logger.info("━━━ KPI LOOKUP HANDLER ━━━")
    
    if not task_plan.kpis_to_compute:
        return {
            "answer": "I couldn't identify which KPI you're asking about. Please be more specific.",
            "artifacts": [],
            "reasoning": []
        }
    
    results = []
    for kpi_id in task_plan.kpis_to_compute:
        kpi = compute_kpi(kpi_id)
        if kpi:
            results.append(f"**{kpi['name']}**: {kpi['formatted']}")
            if kpi.get('description'):
                results.append(f"  _{kpi['description']}_")
    
    if results:
        answer = "\n".join(results)
    else:
        answer = "Could not compute the requested KPIs with the available data."
    
    return {"answer": answer, "artifacts": [], "reasoning": [], "kpis": task_plan.kpis_to_compute}


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: APPROACH PLANNING (for complex analysis)
# ═══════════════════════════════════════════════════════════════════════════════

def build_detailed_schemas(datasets_needed: List[str], all_datasets: List[dict]) -> str:
    """Build detailed schema text for relevant datasets."""
    detailed_schemas = ""
    dataset_names = datasets_needed if datasets_needed else [d["name"] for d in all_datasets[:5]]
    
    for ds_name in dataset_names:
        try:
            schema = get_schema(ds_name)
            detailed_schemas += f"\n\n### '{ds_name}' Schema:\n"
            for col in schema:
                detailed_schemas += f"  - {col['col_name']} ({col['dtype']})"
                if col['sample_values']:
                    samples = str(col['sample_values'][:3])[:50]
                    detailed_schemas += f" | samples: {samples}"
                detailed_schemas += "\n"
            
            first_rows = get_first_rows(ds_name, 3)
            if not first_rows.empty:
                detailed_schemas += "  Preview (first 3 rows):\n"
                for _, row in first_rows.head(3).iterrows():
                    row_preview = {k: str(v)[:20] for k, v in row.items()}
                    detailed_schemas += f"    {row_preview}\n"
        except Exception as e:
            logger.debug(f"Could not get schema for {ds_name}: {e}")
    
    return detailed_schemas


def generate_approach_plan(
    query: str, 
    task_plan: TaskPlan, 
    datasets: List[dict], 
    conversation_context: str = ""
) -> str:
    """
    Phase 2: Approach Planning
    Deep reasoning about analysis approach. Does NOT include chart generation code.
    """
    logger.info("━━━ PHASE 2: Approach Planning ━━━")
    
    dataset_overview = "\n".join([
        f"• '{ds['name']}' ({ds['row_count']} rows, {ds['col_count']} cols)"
        for ds in datasets
    ])
    
    detailed_schemas = build_detailed_schemas(task_plan.datasets_needed, datasets)
    
    context_section = ""
    if conversation_context:
        context_section = f"""
CONVERSATION HISTORY:
{conversation_context}
"""
    
    # Include KPI info if any KPIs might be useful
    kpi_section = ""
    if task_plan.kpis_to_compute:
        kpi_section = "\nRELEVANT KPIs AVAILABLE:\n"
        for kpi_id in task_plan.kpis_to_compute:
            details = get_kpi_details(kpi_id)
            if details:
                kpi_section += f"- {kpi_id}: {details.get('formula', 'N/A')}\n"
    
    system_prompt = """You are a senior data analyst. Create a clear, actionable analysis plan.

Think step by step:
1. Understand EXACTLY what the user wants
2. Identify which dataset(s) and columns are needed
3. Plan the data transformations (groupby, filter, aggregate, etc.)
4. If visualization is needed, specify chart type and data structure

IMPORTANT: 
- Focus on the DATA ANALYSIS steps
- If a chart is needed, just describe WHAT to visualize, not HOW to render it
- The plotting will be handled separately by a visualization agent"""

    prompt = f"""Create an analysis plan for this request.
{context_section}
QUESTION: {query}

AVAILABLE DATASETS:
{dataset_overview}

DETAILED SCHEMAS:{detailed_schemas}
{kpi_section}

Create a numbered EXECUTION PLAN covering:
1. Data source(s) to use
2. Filtering/selection criteria
3. Grouping/aggregation needed
4. Calculations to perform
5. Expected output structure
6. If visualization needed: chart type and what it should show

Be specific about column names and operations."""

    response = think_complete(
        [{"role": "user", "content": prompt}],
        system_prompt=system_prompt,
        temperature=0.3,
        max_tokens=1200
    )
    plan = response.strip()
    
    # Log first few lines
    plan_lines = plan.split('\n')
    logger.info("Approach Plan:")
    for line in plan_lines[:8]:
        if line.strip():
            logger.info(f"  {line.strip()[:80]}")
    
    return plan


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3: CODE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_code(
    query: str,
    task_plan: TaskPlan,
    datasets: List[dict],
    approach_plan: str = "",
) -> str:
    """
    Phase 3: Code Generation
    Generate Python code for analysis. Chart creation uses create_chart() helper.
    """
    logger.info("━━━ PHASE 3: Code Generation ━━━")
    
    # Build schema context
    schema_context = ""
    needed = set(task_plan.datasets_needed) if task_plan.datasets_needed else set()
    
    for ds in datasets:
        is_needed = ds["name"] in needed or len(datasets) <= 10
        if is_needed:
            try:
                schema = get_schema(ds["name"])
                schema_context += f"\n\n### Dataset: '{ds['name']}' ({ds['row_count']} rows)\n"
                schema_context += "Columns:\n"
                for col in schema:
                    schema_context += f"  - `{col['col_name']}` ({col['dtype']})"
                    if col['sample_values']:
                        schema_context += f" -- samples: {col['sample_values'][:3]}"
                    schema_context += "\n"
            except:
                schema_context += f"\n\n### Dataset: '{ds['name']}'\nColumns: {ds['columns']}\n"
    
    plan_section = ""
    if approach_plan:
        plan_section = f"""
ANALYSIS PLAN (follow this):
{approach_plan}
"""
    
    prompt = f"""Generate Python code to answer this data analysis question.

QUESTION: {query}
{plan_section}
AVAILABLE DATA:{schema_context}

CRITICAL RULES:
1. These already exist - DO NOT redefine: get_full_dataset, create_chart, RESULT
2. Load data: df = get_full_dataset('exact-dataset-name')
3. Use EXACT column names from schema (case-sensitive!)
4. Convert numpy to Python: int(value), float(value)
5. For charts use: create_chart(type, title, data_list, x_key, y_keys)
   - type: 'bar', 'line', 'area', 'pie'
   - data_list: list of dicts
   - x_key: key for X-axis labels
   - y_keys: list of keys for Y values
6. ALWAYS set RESULT['summary'] = "your text answer"
7. After groupby().agg(), use .reset_index()

CHART EXAMPLES:

Simple bar:
data = [{{'User': 'Alice', 'Count': 100}}, {{'User': 'Bob', 'Count': 80}}]
create_chart('bar', 'Users by Count', data, 'User', ['Count'])

Grouped bar:
data = [
    {{'User': 'Alice', 'Facebook': 50, 'Instagram': 30}},
    {{'User': 'Bob', 'Facebook': 40, 'Instagram': 25}}
]
create_chart('bar', 'Users by Platform', data, 'User', ['Facebook', 'Instagram'])

OUTPUT ONLY THE CODE BODY (no imports, no markdown fences):"""

    response = think_complete([{"role": "user", "content": prompt}], temperature=0.2)
    
    code = response.strip()
    
    # Remove markdown fences if present
    if "```" in code:
        match = re.search(r'```(?:python)?\s*\n?(.*?)```', code, re.DOTALL | re.IGNORECASE)
        if match:
            code = match.group(1).strip()
        else:
            code = code.replace("```python", "").replace("```", "").strip()
    
    logger.info(f"Generated {len(code)} chars of code")
    return code


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def run_planner(query: str, conversation_context: str = "") -> dict:
    """
    Main entry point - runs planning phases based on LLM task understanding.
    
    Args:
        query: User's question
        conversation_context: Previous conversation history
    
    Returns: {answer: str, artifacts: list, reasoning: list, datasets_used: list}
    """
    logger.info("=" * 60)
    logger.info(f"PLANNER START: {query[:80]}{'...' if len(query) > 80 else ''}")
    logger.info("=" * 60)
    
    # Phase 1: LLM-based task understanding
    task_plan = understand_task(query, conversation_context)
    
    # Route based on task type
    if task_plan.task_type == TaskType.GREETING:
        return handle_greeting(query)
    
    if task_plan.task_type == TaskType.LIST_DATA:
        return handle_list_data()
    
    if task_plan.task_type == TaskType.DESCRIBE_DATA:
        return handle_describe_data(task_plan)
    
    if task_plan.task_type == TaskType.KPI_LOOKUP:
        return handle_kpi_lookup(task_plan)
    
    # For ANALYSIS and VISUALIZATION, use full pipeline
    datasets = list_datasets()
    logger.info(f"Available datasets: {len(datasets)}")
    
    # Phase 2: Approach Planning
    approach_plan = generate_approach_plan(query, task_plan, datasets, conversation_context)
    
    # Phase 3: Code Generation
    code = generate_code(query, task_plan, datasets, approach_plan)
    
    # Phase 4: Code Execution with Reflexion
    logger.info("━━━ PHASE 4: Code Execution ━━━")
    from code_agent.executor import execute_code_with_retry
    
    result = execute_code_with_retry(code, description=query, max_retries=3)
    
    # Build response
    artifacts = []
    answer = ""
    datasets_used = task_plan.datasets_needed or []
    
    if result["success"]:
        logger.info("Execution successful")
        inner = result.get("result", {})
        if isinstance(inner, dict):
            if inner.get("charts"):
                artifacts.extend(inner["charts"])
                logger.info(f"  Charts: {len(inner['charts'])}")
            if inner.get("tables"):
                artifacts.extend(inner["tables"])
                logger.info(f"  Tables: {len(inner['tables'])}")
            answer = inner.get("summary", "Analysis complete.")
            if inner.get("data"):
                answer += f"\n\nData: {json.dumps(inner['data'], default=str)}"
        else:
            answer = str(inner) if inner else "Analysis complete."
    else:
        error_preview = result.get('error', 'Unknown error')[:150]
        logger.error(f"✗ Execution failed: {error_preview}")
        answer = f"I encountered an error during analysis: {error_preview}"
        if result.get("reflections"):
            answer += f"\n\nI tried to fix it: {result['reflections'][-1][:100]}"
    
    logger.info("=" * 60)
    logger.info(f"PLANNER END - Answer: {answer[:100]}...")
    logger.info("=" * 60)
    
    return {
        "answer": answer,
        "artifacts": artifacts,
        "datasets_used": datasets_used,
        "reasoning": [
            {"phase": "task_understanding", "type": task_plan.task_type.value, "intent": task_plan.intent},
            {"phase": "code_generation", "code_length": len(code)},
            {"phase": "execution", "success": result["success"]}
        ]
    }
