"""
FastAPI Backend - Main API server for Frammer Agent.
Provides endpoints for chat, data management, and artifacts.
"""
import os
import sys
import json
import asyncio
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

# Add parent directory to path for imports FIRST
_backend_dir = Path(__file__).parent
_agent_dir = _backend_dir.parent
_project_dir = _agent_dir.parent
sys.path.insert(0, str(_project_dir))

from dotenv import load_dotenv

# Load environment variables from .env file
env_path = _agent_dir / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv(_project_dir / ".env", override=True)

# Import config to set up logging
from frammer_agent.config import setup_logging, LOG_FILE

# Set up logger
logger = logging.getLogger("frammer.api")
logger.info(f"Logging to: {LOG_FILE}")

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Lift model imports
from analytics.lift_service import (
    score_video,
    load_lift_artifacts,
)

# Lift model imports
from analytics.lift_service import (
    score_video,
    load_lift_artifacts,
)

# Configuration with fallbacks
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
DATA_DIR = os.getenv("FRAMMER_DATA_DIR", str(_project_dir))
CHART_CATEGORIES = {}

# Lazy imports for optional modules
_bootstrap_imported = False
_registry_imported = False

def _import_modules():
    """Lazy import of heavy modules."""
    global _bootstrap_imported, _registry_imported, _agent_imported
    
    if not _bootstrap_imported:
        try:
            # Use relative imports within backend
            from session import run_bootstrap, get_bootstrap
            globals()['run_bootstrap'] = run_bootstrap
            globals()['get_bootstrap'] = get_bootstrap
            _bootstrap_imported = True
        except Exception as e:
            print(f"Bootstrap import error: {e}")
            globals()['run_bootstrap'] = lambda: {"datasets_loaded": 0, "metrics_loaded": 0, "charts_found": 0, "errors": [str(e)]}
            globals()['get_bootstrap'] = lambda: None
            _bootstrap_imported = True
    
    if not _registry_imported:
        try:
            from context_manager import get_registry
            globals()['get_registry'] = get_registry
            _registry_imported = True
        except Exception as e:
            print(f"Registry import error: {e}")
            # Create a dummy registry
            class DummyRegistry:
                def list_datasets(self): return []
                def get_dataset(self, id): return None
                def get_sample(self, id, limit=10): raise ValueError("Not available")
                def get_metrics(self, category=None): return []
                def get_schema_summary(self): return ""
            globals()['get_registry'] = lambda: DummyRegistry()
            _registry_imported = True
    
    # Note: chat endpoint now uses planner.py + conversation_memory.py directly
    # instead of the orchestrator/graph_new agent. No lazy import needed.


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    _import_modules()

    # ── Clean up session artifacts that don't survive across machines ────
    import shutil

    # Remove uploaded datasets from previous session and recreate empty dir
    uploads_dir = _agent_dir / "data" / "datasets" / "uploads"
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir, ignore_errors=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # Remove merged output from previous session (rebuilt by merger each run)
    merged_dir = _agent_dir / "data" / "merged"
    if merged_dir.exists():
        shutil.rmtree(merged_dir, ignore_errors=True)
    merged_dir.mkdir(parents=True, exist_ok=True)

    # Reset standalone mode and clean up standalone reports
    active_mode_path = _agent_dir / "data" / "saved_analytics" / "active_mode.json"
    if active_mode_path.exists():
        active_mode_path.unlink(missing_ok=True)
    standalone_reports_dir = _agent_dir / "data" / "saved_analytics" / "standalone_reports"
    if standalone_reports_dir.exists():
        shutil.rmtree(standalone_reports_dir, ignore_errors=True)

    # Remove SQLite DBs (contain stale metadata, rebuilt by bootstrap)
    for db_file in [
        _agent_dir / "data" / "registry.db",
        _agent_dir / "merger.db",
        _backend_dir / "merger.db",
    ]:
        if db_file.exists():
            db_file.unlink(missing_ok=True)

    # Remove legacy generated scripts (embed absolute paths from other machines)
    for script in [
        _agent_dir / "data" / "saved_analytics" / "kpi_script.py",
        _agent_dir / "data" / "saved_analytics" / "chart_data_script.py",
        _agent_dir / "data" / "saved_analytics" / "script_manifest.json",
        _agent_dir / "data" / "session_context.json",
    ]:
        if script.exists():
            script.unlink(missing_ok=True)

    # Keep these — they ARE the caching system:
    #   dataset_hashes.json       → hash-based change detection (cache vs recompute)
    #   analytics_dashboard.json  → cached dashboard (served when hashes match)
    #   dataset_paths.json        → role→path map (rebuilt if hashes change)
    #   column_mappings.json      → LLM column mappings (content-hash-keyed)
    #   role_classifications.json → LLM role classifications (content-hash-keyed)

    print("🧹 Cleared stale session artifacts (DBs, legacy scripts)")


    # ── Clean up session artifacts that don't survive across machines ────
    import shutil

    # Remove uploaded datasets from previous session and recreate empty dir
    uploads_dir = _agent_dir / "data" / "datasets" / "uploads"
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir, ignore_errors=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # Remove merged output from previous session (rebuilt by merger each run)
    merged_dir = _agent_dir / "data" / "merged"
    if merged_dir.exists():
        shutil.rmtree(merged_dir, ignore_errors=True)
    merged_dir.mkdir(parents=True, exist_ok=True)

    # Reset standalone mode and clean up standalone reports
    active_mode_path = _agent_dir / "data" / "saved_analytics" / "active_mode.json"
    if active_mode_path.exists():
        active_mode_path.unlink(missing_ok=True)
    standalone_reports_dir = _agent_dir / "data" / "saved_analytics" / "standalone_reports"
    if standalone_reports_dir.exists():
        shutil.rmtree(standalone_reports_dir, ignore_errors=True)

    # Remove SQLite DBs (contain stale metadata, rebuilt by bootstrap)
    for db_file in [
        _agent_dir / "data" / "registry.db",
        _agent_dir / "merger.db",
        _backend_dir / "merger.db",
    ]:
        if db_file.exists():
            db_file.unlink(missing_ok=True)

    # Remove legacy generated scripts (embed absolute paths from other machines)
    for script in [
        _agent_dir / "data" / "saved_analytics" / "kpi_script.py",
        _agent_dir / "data" / "saved_analytics" / "chart_data_script.py",
        _agent_dir / "data" / "saved_analytics" / "script_manifest.json",
        _agent_dir / "data" / "session_context.json",
    ]:
        if script.exists():
            script.unlink(missing_ok=True)

    # Keep these — they ARE the caching system:
    #   dataset_hashes.json       → hash-based change detection (cache vs recompute)
    #   analytics_dashboard.json  → cached dashboard (served when hashes match)
    #   dataset_paths.json        → role→path map (rebuilt if hashes change)
    #   column_mappings.json      → LLM column mappings (content-hash-keyed)
    #   role_classifications.json → LLM role classifications (content-hash-keyed)

    print("🧹 Cleared stale session artifacts (DBs, legacy scripts)")

    # Startup: Run bootstrap
    print("🚀 Starting Frammer Agent...")
    try:
        result = run_bootstrap()
        print(f"✅ Bootstrap complete: {result['datasets_loaded']} datasets, {result['metrics_loaded']} metrics")
        if result.get("errors"):
            print(f"⚠️ Warnings: {result['errors']}")
    except Exception as e:
        print(f"⚠️ Bootstrap error: {e}")

    # Run analytics pipeline on startup so frontend has fresh KPIs/charts
    try:
        from analytics.analytics_engine import run_analytics
        analytics_result = run_analytics(force=True)
        change = analytics_result.get("change_type", "unknown")
        cached = analytics_result.get("from_cache", False)
        count = analytics_result.get("count", 0)
        if cached:
            logger.info(f"📊 Analytics: {count} metrics loaded from cache")
        else:
            logger.info(f"📊 Analytics: {count} metrics computed (change_type={change})")
    except Exception as e:
        logger.warning(f"⚠️ Analytics engine failed during startup: {e}")

    # Generate recommendations in background (non-blocking)
    try:
        from rec_engine.engine import generate_recommendations
        generate_recommendations(force=True)
        logger.info("🎯 Recommendations generated on startup")
    except Exception as e:
        logger.warning(f"⚠️ Recommendation engine failed during startup: {e}")

    # Initialize in-memory dataset registry AFTER analytics pipeline
    # so it reads from dataset_paths.json (same data the dashboard uses)
    from dataset_registry import initialize_registry
    initialize_registry()
    yield
    # Shutdown
    print("👋 Shutting down Frammer Agent...")


# ─── App Initialization ──────────────────────────────────────────────────────

app = FastAPI(
    title="Frammer Agent API",
    description="Agentic AI backend for data analysis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mode: Optional[str] = None
    conversation_context: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    artifacts: List[Dict[str, Any]] = []
    suggestions: List[str] = []


class DatasetInfo(BaseModel):
    id: int
    name: str
    row_count: int
    col_count: int
    description: str


class MetricInfo(BaseModel):
    name: str
    value: float
    formatted: str
    category: str


class VideoPayload(BaseModel):
    topic: str
    hashtags: List[str]
    region: str
    language: str
    engagement_score: float
    platforms: Optional[List[str]] = None


class LiftScoreRequest(BaseModel):
    video: VideoPayload


# ─── Health Check ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "frammer-agent"}


# ─── Chat Endpoint (planner or explanation routing) ─────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint — routes to planner or explanation agent with memory."""
    session_id = request.session_id or str(uuid.uuid4())
    logger.info(f"Chat request: {request.message[:100]}... (session: {session_id[:8]})")

    try:
        from conversation_memory import get_session_memory
        session_memory = get_session_memory(session_id)

        # Get conversation context — prefer server-side memory, fallback to frontend-sent context
        conversation_context = session_memory.get_context_for_llm(include_last_n=5)
        if not conversation_context and request.conversation_context:
            conversation_context = request.conversation_context

        # Route to explanation, recommendation, KPI, or analytics using LangGraph
        from orchestrator.langgraph_orchestrator import run_chat_graph

        forced_mode = (request.mode or "").lower().strip()
        graph_output = run_chat_graph(
            request.message,
            conversation_context=conversation_context,
            forced_route=forced_mode,
        )
        result = graph_output.get("result", {})
        route = graph_output.get("route", "analyze")

        # Extract key findings from result
        key_findings = []
        if result.get("answer"):
            first_sentence = result["answer"].split('.')[0]
            if len(first_sentence) > 10:
                key_findings.append(first_sentence)

        datasets_used = result.get("datasets_used", [])

        charts_created = []
        for artifact in result.get("artifacts", []):
            if artifact.get("type") == "chart" and artifact.get("title"):
                charts_created.append(artifact["title"])

        # Store this turn in memory
        session_memory.add_turn(
            user_query=request.message,
            assistant_response=result["answer"],
            datasets_used=datasets_used,
            charts_created=charts_created,
            key_findings=key_findings,
        )

        # Generate smart follow-up suggestions based on context
        suggestions = result.get("suggestions", [])
        if route != "explain" and not suggestions:
            suggestions = _generate_followup_suggestions(
                query=request.message,
                datasets_used=datasets_used,
                charts_created=charts_created,
                session_memory=session_memory,
            )

        artifacts = result.get("artifacts", [])
        logger.info(f"Response: {len(result['answer'])} chars, {len(artifacts)} artifacts")

        return ChatResponse(
            response=result["answer"],
            session_id=session_id,
            artifacts=artifacts,
            suggestions=suggestions,
        )

    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _generate_followup_suggestions(
    query: str, datasets_used: list, charts_created: list, session_memory
) -> list:
    """Generate contextual follow-up suggestions based on conversation."""
    suggestions = []

    if datasets_used:
        ds = datasets_used[0]
        if "user" in ds.lower():
            suggestions.append("Show me the bottom 5 users")
            suggestions.append("Compare this with the previous month")
        elif "channel" in ds.lower():
            suggestions.append("Which channel has the highest growth?")
            suggestions.append("Show channel-wise monthly trend")
        elif "month" in ds.lower():
            suggestions.append("Forecast the next 3 months")
            suggestions.append("Which month had the highest activity?")

    if charts_created:
        if any("bar" in c.lower() for c in charts_created):
            suggestions.append("Show this as a pie chart instead")
        suggestions.append("Explain these results in more detail")

    if len(session_memory.turns) > 0:
        suggestions.append("Compare this with my previous analysis")

    if not suggestions:
        suggestions = [
            "What datasets do you have?",
            "Show me the top performers",
            "Create a monthly trend chart",
        ]

    return suggestions[:3]


# ─── Dataset Endpoints ───────────────────────────────────────────────────────

@app.get("/datasets")
async def list_datasets():
    """List all registered datasets."""
    _import_modules()
    try:
        registry = get_registry()
        datasets = registry.list_datasets()
        return {"datasets": datasets}
    except Exception as e:
        return {"datasets": [], "error": str(e)}


@app.get("/datasets/lineage")
async def get_dataset_lineage():
    """Return the full dataset lineage graph: source files -> classified roles -> merged outputs.

    Generic, no hardcoded roles or filenames — derived entirely from the analytics
    registry, file scan, and classification cache. Suitable for any frontend.
    """
    try:
        sys.path.insert(0, str(_backend_dir))
        from analytics.analytics_engine import _load_registry_config
        from analytics.merger import find_merge_candidates
        from analytics.role_classifier import load_cached_classifications

        registry_config = _load_registry_config()
        registry_datasets = registry_config.get("datasets", {})

        # Group source files by role (same logic the pipeline uses)
        groups, unmatched_paths = find_merge_candidates(registry_datasets)

        # Load classification cache for method info
        classification_cache = load_cached_classifications()
        method_by_filename: Dict[str, str] = {}
        for _hash, info in classification_cache.items():
            if info.get("filename"):
                method_by_filename[info["filename"]] = info.get("method", "unknown")

        # Load current dataset_paths to know what the pipeline actually uses
        dataset_paths_file = _agent_dir / "data" / "saved_analytics" / "dataset_paths.json"
        dataset_paths: Dict[str, str] = {}
        if dataset_paths_file.exists():
            try:
                dataset_paths = json.loads(dataset_paths_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Build source_files list
        source_files = []
        for role, paths in groups.items():
            for p in paths:
                source_files.append({
                    "filename": p.name,
                    "file_path": str(p),
                    "role": role,
                    "classification_method": method_by_filename.get(p.name, "pattern"),
                })

        # Build roles dict
        import pandas as pd
        roles: Dict[str, Any] = {}
        for role, paths in groups.items():
            source_names = [p.name for p in paths]
            is_merged = len(paths) > 1
            active_path = dataset_paths.get(role, str(paths[0]))

            row_count = col_count = 0
            try:
                df_peek = pd.read_csv(active_path, encoding="utf-8-sig", nrows=0)
                col_count = len(df_peek.columns)
                with open(active_path, "r", encoding="utf-8-sig") as fh:
                    row_count = sum(1 for _ in fh) - 1
            except Exception:
                pass

            # Check if this role has a supplement
            supplement_path = dataset_paths.get(f"{role}_supplement")
            has_supplement = supplement_path is not None and Path(supplement_path).exists()
            supp_info = None
            if has_supplement:
                try:
                    df_supp = pd.read_csv(supplement_path, encoding="utf-8-sig", nrows=0)
                    supp_info = {
                        "path": supplement_path,
                        "filename": Path(supplement_path).name,
                        "columns": list(df_supp.columns),
                    }
                except Exception:
                    pass

            roles[role] = {
                "sources": source_names,
                "is_merged": is_merged,
                "active_path": active_path,
                "active_filename": Path(active_path).name,
                "row_count": max(row_count, 0),
                "col_count": col_count,
                "has_supplement": has_supplement,
                "supplement": supp_info,
            }

        unclassified = [{"filename": p.name, "file_path": str(p)} for p in unmatched_paths]

        return {
            "source_files": source_files,
            "roles": roles,
            "unclassified": unclassified,
        }
    except Exception as e:
        logger.exception(f"Lineage endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: int):
    """Get dataset details including schema."""
    _import_modules()
    try:
        registry = get_registry()
        dataset = registry.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        return dataset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Lift Model Endpoint (inference only) ───────────────────────────────────


@app.post("/lift/score")
async def lift_score(body: LiftScoreRequest):
    """Score a single video against the trained lift model.

    Training should be run offline (see analytics/lift_service.py CLI) and
    artifacts placed in data/models/lift/ before calling this endpoint.
    """
    try:
        payload = body.video.dict()
        logger.info("/lift/score payload: %s", payload)

        load_lift_artifacts()
        result = await asyncio.to_thread(score_video, payload)

        logger.info(
            "/lift/score result: best=%s prob=%.4f",
            result.get("best_platform"),
            float(result.get("probability", 0.0)),
        )
        return {"status": "ok", "result": result}
    except FileNotFoundError:
        logger.exception("/lift/score artifacts missing")
        raise HTTPException(
            status_code=500,
            detail="Lift model artifacts missing. Train offline and place under data/models/lift/",
        )
    except Exception as e:
        logger.exception("/lift/score error")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/datasets/{dataset_id}/sample")
async def get_dataset_sample(
    dataset_id: int,
    limit: int = Query(10, ge=1, le=100)
):
    """Get sample rows from a dataset."""
    _import_modules()
    try:
        registry = get_registry()
        df = registry.get_sample(dataset_id, limit=limit)
        return {
            "columns": list(df.columns),
            "data": df.to_dict(orient="records"),
            "total_rows": len(df)
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = None
):
    """Upload and register a new dataset."""
    try:
        tools_dir = _agent_dir / "tools"
        sys.path.insert(0, str(tools_dir))
        from file_ingest import ingest_uploaded_bytes
        content = await file.read()
        
        result = ingest_uploaded_bytes(
            content=content,
            filename=file.filename,
            name=name
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


ALLOWED_UPLOAD_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _reload_chat_registry(dataset_paths: Optional[Dict[str, str]] = None):
    """Reload the in-memory DatasetRegistry so the chat agent sees updated data.
    If dataset_paths is given, load from that dict. Otherwise re-read dataset_paths.json."""
    try:
        from dataset_registry import get_registry as get_ds_registry
        reg = get_ds_registry()
        if dataset_paths:
            reg.load_from_paths(dataset_paths)
        else:
            reg.reload()
    except Exception as e:
        logger.warning(f"Failed to reload chat registry: {e}")

# ─── Standalone Mode Paths ─────────────────────────────────────────────────
ACTIVE_MODE_PATH = _agent_dir / "data" / "saved_analytics" / "active_mode.json"
STANDALONE_REPORTS_DIR = _agent_dir / "data" / "saved_analytics" / "standalone_reports"


def _get_active_mode() -> dict:
    """Read active_mode.json. Returns {"mode": "main"} if not set."""
    if ACTIVE_MODE_PATH.exists():
        try:
            return json.loads(ACTIVE_MODE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"mode": "main"}


def _set_active_mode(mode_data: dict) -> None:
    """Write active_mode.json."""
    ACTIVE_MODE_PATH.parent.mkdir(parents=True, exist_ok=True)
    ACTIVE_MODE_PATH.write_text(json.dumps(mode_data, indent=2), encoding="utf-8")


@app.post("/datasets/upload-and-analyze")
async def upload_and_analyze(
    files: List[UploadFile] = File(...),
    mode: str = Query("merge", pattern="^(merge|standalone)$"),
):
    """Upload one or more dataset files, classify each via LLM, then merge or analyze standalone.

    mode=merge: save to datasets dir, re-run full analytics pipeline once after all files are saved.
    mode=standalone: save to uploads subdir, run partial analytics on all uploaded files together.
    """
    # Validate all files first
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}' for '{f.filename}'. Allowed: {', '.join(ALLOWED_UPLOAD_EXTENSIONS)}",
            )

    try:
        sys.path.insert(0, str(_backend_dir))
        sys.path.insert(0, str(_agent_dir))

        from analytics.role_classifier import classify_dataset_role as llm_classify, load_cached_classifications, save_cached_classifications
        from analytics.analytics_engine import _load_registry_config, get_engine
        import pandas as pd

        registry_config = _load_registry_config()
        registry_datasets = registry_config.get("datasets", {})

        if mode == "merge":
            dest_dir = _agent_dir / "data" / "datasets"
        else:
            dest_dir = _agent_dir / "data" / "datasets" / "uploads"
        dest_dir.mkdir(parents=True, exist_ok=True)

        cache = load_cached_classifications()
        file_results = []  # per-file classification results
        classified_files = {}  # role -> dest_path (for standalone)

        for f in files:
            content = await f.read()
            dest_path = dest_dir / f.filename

            # Convert xlsx/xls to csv for the pipeline
            ext = Path(f.filename).suffix.lower()
            if ext in (".xlsx", ".xls"):
                try:
                    from io import BytesIO
                    df_conv = pd.read_excel(BytesIO(content))
                    csv_name = Path(f.filename).stem + ".csv"
                    dest_path = dest_dir / csv_name
                    df_conv.to_csv(dest_path, index=False, encoding="utf-8-sig")
                    logger.info(f"Converted {f.filename} → {csv_name}")
                except Exception as e:
                    file_results.append({
                        "filename": f.filename,
                        "status": "error",
                        "error": f"Failed to convert Excel file: {e}",
                    })
                    continue
            else:
                dest_path.write_bytes(content)

            logger.info(f"Saved uploaded file to {dest_path}")

            # Classify
            classified_role = llm_classify(dest_path, registry_datasets, cache)

            if not classified_role:
                try:
                    df_peek = pd.read_csv(dest_path, encoding="utf-8-sig", nrows=3)
                    columns = list(df_peek.columns)
                except Exception:
                    columns = []
                file_results.append({
                    "filename": f.filename,
                    "status": "unclassified",
                    "columns": columns,
                    "error": "Could not classify into any known role",
                })
                continue

            classified_files[classified_role] = str(dest_path)
            file_results.append({
                "filename": f.filename,
                "status": "classified",
                "classified_role": classified_role,
            })

        save_cached_classifications(cache)

        if not classified_files:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "None of the uploaded files could be classified",
                    "files": file_results,
                    "available_roles": list(registry_datasets.keys()),
                },
            )

        if mode == "merge":
            dashboard = get_engine().run(force=False)
            _reload_chat_registry()  # sync chat agent with new merged data
            # Regenerate recommendations with new data
            try:
                from rec_engine.engine import generate_recommendations
                generate_recommendations(force=True)
            except Exception as e:
                logger.warning(f"Recommendations regeneration failed after merge: {e}")
            return {
                "success": True,
                "mode": "merge",
                "files": file_results,
                "dashboard": dashboard,
            }
        else:
            # Standalone: run analytics on all classified uploaded files together
            from analytics.column_mapper import run_column_mapper, load_persisted_mappings
            from analytics.kpi_executor import compute_kpis_from_registry, compute_charts_from_registry

            # Column mapping for each classified role
            role_dfs = {}
            for role, path in classified_files.items():
                try:
                    role_dfs[role] = pd.read_csv(path, encoding="utf-8-sig")
                except Exception as e:
                    logger.warning(f"Failed to read {path} for column mapping: {e}")

            existing_mappings = load_persisted_mappings()
            column_mappings = run_column_mapper(
                role_to_df=role_dfs,
                registry_datasets=registry_datasets,
                existing_mappings=existing_mappings,
                changed_roles=list(classified_files.keys()),
            )

            metrics = compute_kpis_from_registry(column_mappings, classified_files)
            chart_data = compute_charts_from_registry(column_mappings, classified_files)

            # Figure out which KPIs were skipped
            kpi_registry_path = _backend_dir / "analytics" / "kpi_registry.json"
            all_kpis = json.loads(kpi_registry_path.read_text(encoding="utf-8")).get("kpis", [])
            computed_ids = {m.get("id") for m in metrics}
            skipped = [
                {"id": k["id"], "name": k["name"], "reason": f"Requires dataset(s): {k['input']['datasets']}"}
                for k in all_kpis
                if k["id"] not in computed_ids
            ]

            # Build dataset_sources for attribution
            dataset_sources = {}
            for role, path in classified_files.items():
                dataset_sources[role] = {
                    "filename": Path(path).name,
                    "display_name": Path(path).stem,
                }

            # Build a full dashboard-shaped report so frontend can render it identically
            from analytics.analytics_engine import assemble_dashboard
            standalone_dashboard = {
                "generated_at": __import__("datetime").datetime.now().isoformat(),
                "from_cache": False,
                "change_type": "standalone",
                "metrics": metrics,
                "by_category": {},
                "count": len(metrics),
                "chart_data": chart_data,
                "charts": {},
                "dataset_sources": dataset_sources,
                "standalone_mode": True,
                "standalone_filenames": [f.filename for f in files if any(
                    r["filename"] == f.filename and r.get("status") == "classified"
                    for r in file_results
                )],
                "standalone_roles": list(classified_files.keys()),
                "skipped_kpis": skipped,
            }

            # Group metrics by category
            for m in metrics:
                cat = m.get("category", "other")
                standalone_dashboard["by_category"].setdefault(cat, []).append(m)

            # Persist the report
            report_id = str(uuid.uuid4())
            STANDALONE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            report_path = STANDALONE_REPORTS_DIR / f"{report_id}.json"
            report_path.write_text(json.dumps(standalone_dashboard, indent=2, default=str), encoding="utf-8")

            # Set active mode to standalone
            _set_active_mode({
                "mode": "standalone",
                "report_id": report_id,
                "filenames": standalone_dashboard["standalone_filenames"],
                "roles": list(classified_files.keys()),
            })

            # Sync registry.db: wipe old entries, register only standalone files
            try:
                from context_manager import get_registry
                registry = get_registry()
                registry.clear_all_datasets()
                for role, path in classified_files.items():
                    registry.register_dataset(file_path=path, name=role, domain_tags=[role])
                # Also save metrics so chat agent can reference them
                for m in metrics:
                    registry.save_metric(
                        name=m.get("name", m.get("id", "")),
                        value=float(m.get("value", 0)) if isinstance(m.get("value"), (int, float)) else 0,
                        formatted=m.get("formatted", ""),
                        category=m.get("category", ""),
                        description=m.get("description", ""),
                    )
                logger.info(f"Registry.db synced with {len(classified_files)} standalone datasets")
            except Exception as e:
                logger.warning(f"Failed to sync registry.db for standalone mode: {e}")

            # Sync in-memory chat registry with standalone files only
            _reload_chat_registry(classified_files)

            logger.info(f"Standalone report saved: {report_id} with {len(metrics)} metrics")

            return {
                "success": True,
                "mode": "standalone",
                "report_id": report_id,
                "files": file_results,
                "metrics": metrics,
                "chart_data": chart_data,
                "skipped_kpis": skipped,
                "available_roles": list(classified_files.keys()),
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload and analyze failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Standalone Analyze (Isolated - Does NOT affect main dashboard) ──────────

@app.post("/standalone-analyze")
async def standalone_analyze(
    files: List[UploadFile] = File(...),
):
    """Upload and analyze files in isolation - does NOT affect main dashboard.
    
    Returns analytics results directly without saving to active_mode or modifying
    the main dashboard state. Perfect for ad-hoc analysis.
    """
    import tempfile
    import shutil
    
    # Validate all files first
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}' for '{f.filename}'. Allowed: {', '.join(ALLOWED_UPLOAD_EXTENSIONS)}",
            )

    # Create temp directory for this analysis session
    temp_dir = Path(tempfile.mkdtemp(prefix="frammer_analyze_"))
    
    try:
        sys.path.insert(0, str(_backend_dir))
        sys.path.insert(0, str(_agent_dir))

        from analytics.role_classifier import classify_dataset_role as llm_classify, load_cached_classifications, save_cached_classifications
        from analytics.analytics_engine import _load_registry_config
        import pandas as pd

        registry_config = _load_registry_config()
        registry_datasets = registry_config.get("datasets", {})

        cache = load_cached_classifications()
        file_results = []
        classified_files = {}
        uploaded_filenames = []

        for f in files:
            content = await f.read()
            uploaded_filenames.append(f.filename)
            
            # Convert xlsx/xls to csv
            ext = Path(f.filename).suffix.lower()
            if ext in (".xlsx", ".xls"):
                try:
                    from io import BytesIO
                    df_conv = pd.read_excel(BytesIO(content))
                    csv_name = Path(f.filename).stem + ".csv"
                    dest_path = temp_dir / csv_name
                    df_conv.to_csv(dest_path, index=False, encoding="utf-8-sig")
                    logger.info(f"Converted {f.filename} → {csv_name}")
                except Exception as e:
                    file_results.append({
                        "filename": f.filename,
                        "status": "error",
                        "error": f"Failed to convert Excel file: {e}",
                    })
                    continue
            else:
                dest_path = temp_dir / f.filename
                dest_path.write_bytes(content)

            # Classify
            classified_role = llm_classify(dest_path, registry_datasets, cache)

            if not classified_role:
                try:
                    df_peek = pd.read_csv(dest_path, encoding="utf-8-sig", nrows=3)
                    columns = list(df_peek.columns)
                except Exception:
                    columns = []
                file_results.append({
                    "filename": f.filename,
                    "status": "unclassified",
                    "columns": columns,
                    "error": "Could not classify into any known role",
                })
                continue

            classified_files[classified_role] = str(dest_path)
            file_results.append({
                "filename": f.filename,
                "status": "classified",
                "classified_role": classified_role,
            })

        save_cached_classifications(cache)

        if not classified_files:
            # Clean up temp dir
            shutil.rmtree(temp_dir, ignore_errors=True)
            return {
                "success": False,
                "error": "None of the uploaded files could be classified",
                "files": file_results,
                "available_roles": list(registry_datasets.keys()),
                "metrics": [],
                "chart_data": {},
            }

        # Run analytics on classified files
        from analytics.column_mapper import run_column_mapper, load_persisted_mappings
        from analytics.kpi_executor import compute_kpis_from_registry, compute_charts_from_registry

        role_dfs = {}
        for role, path in classified_files.items():
            try:
                role_dfs[role] = pd.read_csv(path, encoding="utf-8-sig")
            except Exception as e:
                logger.warning(f"Failed to read {path}: {e}")

        existing_mappings = load_persisted_mappings()
        column_mappings = run_column_mapper(
            role_to_df=role_dfs,
            registry_datasets=registry_datasets,
            existing_mappings=existing_mappings,
            changed_roles=list(classified_files.keys()),
        )

        metrics = compute_kpis_from_registry(column_mappings, classified_files)
        chart_data = compute_charts_from_registry(column_mappings, classified_files)

        # Build dataset info
        dataset_info = {}
        for role, path in classified_files.items():
            try:
                df = pd.read_csv(path, encoding="utf-8-sig")
                dataset_info[role] = {
                    "filename": Path(path).name,
                    "rows": len(df),
                    "columns": list(df.columns),
                }
            except Exception:
                dataset_info[role] = {"filename": Path(path).name, "rows": 0, "columns": []}

        # Group metrics by category
        by_category = {}
        for m in metrics:
            cat = m.get("category", "other")
            by_category.setdefault(cat, []).append(m)

        # Clean up temp dir
        shutil.rmtree(temp_dir, ignore_errors=True)

        logger.info(f"Standalone analyze completed: {len(metrics)} metrics, {len(chart_data)} charts")

        return {
            "success": True,
            "files": file_results,
            "metrics": metrics,
            "by_category": by_category,
            "chart_data": chart_data,
            "dataset_info": dataset_info,
            "uploaded_filenames": uploaded_filenames,
            "classified_roles": list(classified_files.keys()),
        }

    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.error(f"Standalone analyze failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Metrics Endpoints ───────────────────────────────────────────────────────

@app.get("/metrics")
async def get_metrics(category: Optional[str] = None):
    """Get computed metrics/KPIs (uses analytics engine, falls back to registry)."""
    _import_modules()
    try:
        from analytics.analytics_engine import get_engine
        dashboard = get_engine().get_dashboard()
        metrics = dashboard.get("metrics", [])
        if category:
            metrics = [m for m in metrics if m.get("category") == category]
        return {"metrics": metrics}
    except Exception as e:
        logger.warning(f"Metrics endpoint error: {e}")
        try:
            registry = get_registry()
            metrics = registry.get_metrics(category=category)
            return {"metrics": metrics}
        except Exception:
            return {"metrics": [], "error": str(e)}


@app.get("/kpi-summary")
async def get_kpi_summary():
    """Get KPI summary for dashboard."""
    _import_modules()
    try:
        # Prefer analytics engine
        from analytics.analytics_engine import get_engine
        return get_engine().get_kpi_summary()
    except Exception:
        # Fallback to existing bootstrap
        try:
            bootstrap = get_bootstrap()
            if bootstrap:
                return bootstrap.get_kpi_summary()
        except Exception:
            pass
        return {"metrics": [], "by_category": {}, "count": 0}


# ─── Analytics Dashboard Endpoints ──────────────────────────────────────────

@app.get("/analytics-dashboard")
async def get_analytics_dashboard():
    """Get the complete analytics dashboard. If standalone mode is active, serve the standalone report."""
    _import_modules()
    try:
        # Check if standalone mode is active
        mode_data = _get_active_mode()
        if mode_data.get("mode") == "standalone":
            report_id = mode_data.get("report_id")
            report_path = STANDALONE_REPORTS_DIR / f"{report_id}.json"
            if report_path.exists():
                report = json.loads(report_path.read_text(encoding="utf-8"))
                report["standalone_mode"] = True
                return report
            else:
                # Report file missing, revert to main
                _set_active_mode({"mode": "main"})

        from analytics.analytics_engine import get_engine
        dashboard = get_engine().get_dashboard()
        dashboard["standalone_mode"] = False
        return dashboard
    except Exception as e:
        logger.exception(f"Analytics dashboard error: {e}")
        return {"metrics": [], "by_category": {}, "count": 0, "chart_data": {}, "charts": {}, "error": str(e)}


@app.get("/active-mode")
async def get_active_mode():
    """Get current dashboard mode (standalone vs main)."""
    return _get_active_mode()


@app.post("/restore-main-dashboard")
async def restore_main_dashboard():
    """Switch back from standalone mode to main multi-dataset dashboard.
    Re-runs the full analytics pipeline so registry.db is repopulated with main datasets."""
    _set_active_mode({"mode": "main"})

    # Re-run analytics so registry.db gets re-populated with main datasets
    # (_register_datasets_in_db is called inside the engine's schema/data paths)
    try:
        from analytics.analytics_engine import run_analytics
        run_analytics(force=True)
        logger.info("Restored main dashboard and re-synced registry.db")
    except Exception as e:
        logger.warning(f"Failed to re-run analytics on restore: {e}")

    _reload_chat_registry()  # sync chat agent with main datasets
    return {"status": "restored", "mode": "main"}


# ─── Frontend Dashboard Endpoint (New UI format) ─────────────────────────────

@app.get("/frontend-dashboard")
async def get_frontend_dashboard(view: Optional[str] = None):
    """
    Get analytics data formatted for the new frontend UI.
    
    Returns data shaped for: executive, client, funnel, trends, explorer, multidim views.
    
    Args:
        view: Optional specific view to return (executive, client, funnel, trends, explorer, multidim).
              If not provided, returns all views.
    """
    _import_modules()
    try:
        from analytics.analytics_engine import get_engine
        from analytics.frontend_adapter import transform_dashboard_for_frontend, get_view
        
        dashboard = get_engine().get_dashboard()
        
        if view:
            # Return specific view only
            return get_view(dashboard, view)
        else:
            # Return all views
            return transform_dashboard_for_frontend(dashboard)
    except Exception as e:
        logger.exception(f"Frontend dashboard error: {e}")
        return {"error": str(e)}


@app.delete("/datasets/{filename:path}")
async def delete_dataset(filename: str):
    """Delete a dataset file from data/datasets/, clear it from caches, and re-run analytics."""
    _import_modules()
    datasets_dir = _agent_dir / "data" / "datasets"
    file_path = datasets_dir / filename

    # Security: prevent path traversal
    try:
        resolved = file_path.resolve()
        if not str(resolved).startswith(str(datasets_dir.resolve())):
            raise HTTPException(status_code=403, detail="Cannot delete files outside datasets directory")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{filename}' not found")

    # Delete the file
    file_path.unlink()
    logger.info(f"Deleted dataset: {filename}")

    # Clear from dataset_hashes.json
    hashes_path = _agent_dir / "data" / "saved_analytics" / "dataset_hashes.json"
    if hashes_path.exists():
        try:
            hashes = json.loads(hashes_path.read_text(encoding="utf-8"))
            hashes = {k: v for k, v in hashes.items() if not k.endswith(filename)}
            hashes_path.write_text(json.dumps(hashes, indent=2), encoding="utf-8")
        except Exception:
            pass

    # Clear from role_classifications.json
    classifications_path = _agent_dir / "data" / "saved_analytics" / "role_classifications.json"
    if classifications_path.exists():
        try:
            classifications = json.loads(classifications_path.read_text(encoding="utf-8"))
            classifications = {k: v for k, v in classifications.items()
                              if v.get("filename") != filename}
            classifications_path.write_text(json.dumps(classifications, indent=2), encoding="utf-8")
        except Exception:
            pass

    # Re-run analytics
    try:
        from analytics.analytics_engine import run_analytics
        result = run_analytics(force=True)
        _reload_chat_registry()  # sync chat agent after deletion
        return {
            "status": "deleted",
            "filename": filename,
            "metrics_count": result.get("count", 0),
        }
    except Exception as e:
        return {"status": "deleted", "filename": filename, "warning": f"Re-analysis failed: {e}"}


@app.post("/analytics-refresh")
async def refresh_analytics(force: bool = True):
    """Force re-check of dataset hashes and recompute changed analytics."""
    _import_modules()
    try:
        from analytics.analytics_engine import run_analytics
        result = run_analytics(force=force)
        # Regenerate recommendations after analytics refresh
        try:
            from rec_engine.engine import generate_recommendations
            generate_recommendations(force=True)
        except Exception as e:
            logger.warning(f"Recommendations regeneration failed after refresh: {e}")
        return {
            "status": "refreshed",
            "change_type": result.get("change_type", "unknown"),
            "kpis_recomputed": result.get("kpis_recomputed", []),
            "from_cache": result.get("from_cache", False),
            "metrics_count": result.get("count", 0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Recommendations Endpoint ─────────────────────────────────────────────────

@app.get("/recommendations")
async def get_recommendations(force: bool = False):
    """Get LLM-generated strategic recommendations based on analytics data."""
    try:
        from rec_engine.engine import generate_recommendations
        return generate_recommendations(force=force)
    except Exception as e:
        logger.error(f"Recommendations endpoint failed: {e}")
        return {"error": str(e), "recommendations": [], "insights": []}


# ─── Charts Endpoints ────────────────────────────────────────────────────────

@app.get("/charts")
async def get_charts():
    """Get all available charts organized by category."""
    _import_modules()
    try:
        bootstrap = get_bootstrap()
        if bootstrap:
            return {"charts": bootstrap.get_charts_by_category()}
        return {"charts": {}}
    except Exception as e:
        return {"charts": {}, "error": str(e)}


@app.get("/charts/{filename}")
async def get_chart(filename: str):
    """Serve a chart PNG file for the frontend dashboard."""
    chart_path = Path(DATA_DIR) / filename
    if not chart_path.exists():
        raise HTTPException(status_code=404, detail="Chart not found")
    return FileResponse(path=str(chart_path), media_type="image/png", filename=filename)


@app.get("/charts/list")
async def list_charts():
    """List all chart files."""
    try:
        tools_dir = _agent_dir / "tools"
        sys.path.insert(0, str(tools_dir))
        from chart_renderer import list_existing_charts
        charts = list_existing_charts()
        return {"charts": charts}
    except Exception as e:
        # Fallback: scan directory
        charts = []
        chart_dir = Path(DATA_DIR)
        if chart_dir.exists():
            for f in chart_dir.glob("*.png"):
                charts.append({"filename": f.name, "path": str(f)})
        return {"charts": charts}


@app.get("/charts/{filename}")
async def get_chart(filename: str):
    """Get a specific chart file."""
    chart_path = Path(DATA_DIR) / filename
    
    if not chart_path.exists():
        raise HTTPException(status_code=404, detail="Chart not found")
    
    return FileResponse(
        path=str(chart_path),
        media_type="image/png",
        filename=filename
    )


@app.get("/charts/{filename}/base64")
async def get_chart_base64(filename: str):
    """Get chart as base64 encoded data."""
    try:
        tools_dir = _agent_dir / "tools"
        sys.path.insert(0, str(tools_dir))
        from chart_renderer import load_existing_chart
        chart = load_existing_chart(filename)
        
        if not chart:
            raise HTTPException(status_code=404, detail="Chart not found")
        
        return chart
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Schema Endpoints ────────────────────────────────────────────────────────

@app.get("/schema-summary")
async def get_schema_summary():
    """Get natural language schema summary for all datasets."""
    _import_modules()
    try:
        registry = get_registry()
        summary = registry.get_schema_summary()
        return {"summary": summary}
    except Exception as e:
        return {"summary": "", "error": str(e)}


# ─── Session Management ──────────────────────────────────────────────────────

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session history."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return sessions[session_id]


@app.delete("/sessions/{session_id}")
async def clear_session(session_id: str):
    """Clear session history."""
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "cleared"}


# ─── Run Server ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print(f"Starting server on {API_HOST}:{API_PORT}")
    print(f"Data directory: {DATA_DIR}")
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )
