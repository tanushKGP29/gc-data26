"""
Frammer Agent Configuration
All paths, model names, and environment variables are centralized here.
"""
import os
import logging
from pathlib import Path
from datetime import datetime

# ─── Environment Variables ───────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ─── Base Paths ──────────────────────────────────────────────────────────────
# Data directory is parent of frammer_agent (where CSVs and PNGs live)
BASE_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = os.getenv("FRAMMER_DATA_DIR", str(BASE_DIR))
AGENT_DIR = Path(__file__).parent.resolve()

# ─── Datasets Directory ───────────────────────────────────────────────────────
# All CSV datasets live here — analytics engine tracks changes in this dir
DATASETS_DIR = AGENT_DIR / "data" / "datasets"

# ─── Database Paths ──────────────────────────────────────────────────────────
SQLITE_DB_PATH = AGENT_DIR / "data" / "registry.db"
CHROMA_PERSIST_DIR = AGENT_DIR / "data" / "chroma"
SESSION_CONTEXT_PATH = AGENT_DIR / "data" / "session_context.json"
LOG_DIR = AGENT_DIR / "logs"
LOG_FILE = LOG_DIR / f"frammer_{datetime.now().strftime('%Y%m%d')}.log"

# ─── LLM Model Configuration ─────────────────────────────────────────────────
FAST_MODEL = "llama-3.1-8b-instant"        # Used for code gen, routing, narration
THINK_MODEL = "llama-3.3-70b-versatile"    # Used for planning, reflection, insight

# ─── Execution Limits ────────────────────────────────────────────────────────
CODE_EXECUTION_TIMEOUT = 90  # seconds (increased for complex analysis)
MAX_RETRY_ATTEMPTS = 5  # More attempts to allow thinking LLM escalation
MAX_CONTEXT_TOKENS = 8000

# ─── Server Configuration ────────────────────────────────────────────────────
API_HOST = "0.0.0.0"
API_PORT = 8000
FRONTEND_PORT = 3000

# ─── File Patterns ───────────────────────────────────────────────────────────
SUPPORTED_DATA_EXTENSIONS = [".csv", ".json", ".xlsx", ".xls"]
SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"]

# ─── Chart Categories for UI ─────────────────────────────────────────────────
CHART_CATEGORIES = {
    "Funnel Analysis": ["funnel_by_channel.png"],
    "Monthly Trends": ["monthly_trends.png", "monthly_publish_rate.png", "mom_growth.png"],
    "Channel Analysis": [
        "channel_duration.png", "channel_performance_score.png", 
        "channel_platform_counts.png", "channel_quadrant.png", "channel_efficiency.png"
    ],
    "User Analysis": ["user_analysis.png", "user_scatter.png", "heatmap_channel_user.png", "heatmap_channel_user_pr.png"],
    "Output & Input Mix": ["output_type_mix.png", "input_type_mix.png"],
    "Language & Platform": ["language_analysis.png", "platform_distribution.png"],
    "Duration Analytics": ["duration_analytics.png", "h1_vs_h2.png"],
    "Data Quality": ["data_quality_dashboard.png", "dq_audit.png", "correlation_anomaly.png"],
    "KPI Summary": ["kpi_summary.png"]
}

# ─── Ensure data directories exist ───────────────────────────────────────────
def ensure_dirs():
    """Create necessary directories if they don't exist."""
    (AGENT_DIR / "data").mkdir(parents=True, exist_ok=True)
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

ensure_dirs()


# ─── Clear old logs on startup ───────────────────────────────────────────────
def clear_logs_on_startup():
    """Clear all log files and temp scripts from previous sessions."""
    import shutil
    try:
        # Clear log files
        for log_file in LOG_DIR.glob("*.log"):
            try:
                log_file.unlink()
            except:
                pass
        
        # Clear temp script files
        for script_file in LOG_DIR.glob("*.py"):
            try:
                script_file.unlink()
            except:
                pass
        
        # Clear last_script files
        for script_file in LOG_DIR.glob("last_script_*.py"):
            try:
                script_file.unlink()
            except:
                pass
    except Exception as e:
        print(f"Warning: Could not clear logs: {e}")

# Clear logs when this module is first imported (server startup)
clear_logs_on_startup()


# ─── Logging Configuration ───────────────────────────────────────────────────
def setup_logging(level=logging.INFO):
    """Configure logging for the application."""
    # Create formatters
    file_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # File handler - detailed logging
    file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(file_formatter)
    
    # Console handler - less verbose
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(console_formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Configure specific loggers
    logging.getLogger("frammer").setLevel(logging.DEBUG)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    return logging.getLogger("frammer")


# Initialize logging
logger = setup_logging()
