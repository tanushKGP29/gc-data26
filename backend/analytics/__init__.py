"""Analytics module - Adaptive agentic analytics pipeline with modular KPI system."""
from analytics.analytics_engine import get_engine, run_analytics
from analytics.kpi_executor import (
    get_kpi_executor,
    compute_kpis_from_registry,
    compute_charts_from_registry,
    KPIExecutor
)
from analytics.kpi_functions import (
    register_kpi_function,
    list_kpi_functions,
    get_kpi_function,
    get_kpi_function_info,
    KPI_FUNCTION_REGISTRY
)

__all__ = [
    # Engine
    "get_engine", 
    "run_analytics",
    # KPI Executor
    "get_kpi_executor",
    "compute_kpis_from_registry",
    "compute_charts_from_registry",
    "KPIExecutor",
    # KPI Functions
    "register_kpi_function",
    "list_kpi_functions",
    "get_kpi_function",
    "get_kpi_function_info",
    "KPI_FUNCTION_REGISTRY"
]
