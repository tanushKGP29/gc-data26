"""
Chart Renderer Tool - Render and export charts from analysis results.
Handles matplotlib, seaborn, and plotly figures.
"""
import base64
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, Union
from io import BytesIO

# Get paths without importing config
_tools_dir = Path(__file__).parent
_agent_dir = _tools_dir.parent
_project_dir = _agent_dir.parent
DATA_DIR = os.getenv("FRAMMER_DATA_DIR", str(_project_dir))


def render_matplotlib_to_base64(fig) -> str:
    """
    Render a matplotlib figure to base64 PNG string.
    
    Args:
        fig: matplotlib Figure object
    
    Returns:
        Base64 encoded PNG string
    """
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white')
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def render_plotly_to_json(fig) -> str:
    """
    Render a plotly figure to JSON string.
    
    Args:
        fig: plotly Figure object
    
    Returns:
        JSON string representation
    """
    return fig.to_json()


def render_plotly_to_html(fig) -> str:
    """
    Render a plotly figure to HTML string.
    
    Args:
        fig: plotly Figure object
    
    Returns:
        HTML string for embedding
    """
    return fig.to_html(include_plotlyjs='cdn', full_html=False)


def save_figure(
    fig,
    name: str,
    format: str = "png",
    output_dir: Optional[Path] = None
) -> Dict[str, Any]:
    """
    Save a figure to disk.
    
    Args:
        fig: matplotlib or plotly Figure object
        name: Filename without extension
        format: Output format (png, svg, html, json)
        output_dir: Directory to save to (defaults to data/charts)
    
    Returns:
        Dictionary with file path and metadata
    """
    if output_dir is None:
        output_dir = _agent_dir / "data" / "charts"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine figure type
    fig_type = type(fig).__module__.split('.')[0]
    
    if fig_type == 'matplotlib' or hasattr(fig, 'savefig'):
        # Matplotlib figure
        if format == "png":
            path = output_dir / f"{name}.png"
            fig.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        elif format == "svg":
            path = output_dir / f"{name}.svg"
            fig.savefig(path, format='svg', bbox_inches='tight')
        else:
            path = output_dir / f"{name}.png"
            fig.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        
        return {
            "success": True,
            "path": str(path),
            "type": "matplotlib",
            "format": format
        }
    
    elif fig_type == 'plotly' or hasattr(fig, 'to_json'):
        # Plotly figure
        if format == "html":
            path = output_dir / f"{name}.html"
            fig.write_html(path, include_plotlyjs='cdn')
        elif format == "json":
            path = output_dir / f"{name}.json"
            path.write_text(fig.to_json())
        elif format == "png":
            # Requires kaleido
            try:
                path = output_dir / f"{name}.png"
                fig.write_image(path, scale=2)
            except Exception:
                # Fallback to HTML
                path = output_dir / f"{name}.html"
                fig.write_html(path, include_plotlyjs='cdn')
                format = "html"
        else:
            path = output_dir / f"{name}.html"
            fig.write_html(path, include_plotlyjs='cdn')
            format = "html"
        
        return {
            "success": True,
            "path": str(path),
            "type": "plotly",
            "format": format
        }
    
    return {
        "success": False,
        "error": f"Unknown figure type: {fig_type}"
    }


def figure_to_artifact(
    fig_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Convert figure data from execution result to UI artifact format.
    
    Args:
        fig_data: Figure data from execution result
            - For matplotlib: {"type": "matplotlib", "data": base64_string}
            - For plotly: {"type": "plotly", "data": json_string}
    
    Returns:
        Artifact dictionary ready for frontend
    """
    fig_type = fig_data.get("type", "unknown")
    
    if fig_type == "matplotlib":
        return {
            "type": "image",
            "format": "png",
            "data": fig_data.get("data", ""),
            "name": fig_data.get("name", "chart")
        }
    
    elif fig_type == "plotly":
        return {
            "type": "plotly",
            "format": "json",
            "data": fig_data.get("data", "{}"),
            "name": fig_data.get("name", "chart")
        }
    
    return {
        "type": "unknown",
        "data": str(fig_data)
    }


def load_existing_chart(filename: str) -> Optional[Dict[str, Any]]:
    """
    Load an existing chart file from the data directory.
    
    Args:
        filename: Name of the chart file (e.g., "kpi_summary.png")
    
    Returns:
        Artifact dictionary or None if not found
    """
    # Check in parent data directory first (existing analysis charts)
    chart_path = Path(DATA_DIR) / filename
    
    if not chart_path.exists():
        # Check in agent's charts directory
        chart_path = _agent_dir / "data" / "charts" / filename
    
    if not chart_path.exists():
        return None
    
    suffix = chart_path.suffix.lower()
    
    if suffix in [".png", ".jpg", ".jpeg"]:
        content = chart_path.read_bytes()
        return {
            "type": "image",
            "format": suffix[1:],
            "data": base64.b64encode(content).decode('utf-8'),
            "name": chart_path.stem,
            "path": str(chart_path)
        }
    
    elif suffix == ".svg":
        content = chart_path.read_text()
        return {
            "type": "svg",
            "data": content,
            "name": chart_path.stem,
            "path": str(chart_path)
        }
    
    elif suffix == ".html":
        content = chart_path.read_text()
        return {
            "type": "html",
            "data": content,
            "name": chart_path.stem,
            "path": str(chart_path)
        }
    
    elif suffix == ".json":
        content = chart_path.read_text()
        return {
            "type": "plotly",
            "format": "json",
            "data": content,
            "name": chart_path.stem,
            "path": str(chart_path)
        }
    
    return None


def list_existing_charts() -> list:
    """
    List all existing chart files in the data directory.
    
    Returns:
        List of chart file info dictionaries
    """
    SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"]
    
    charts = []
    data_path = Path(DATA_DIR)
    
    for ext in SUPPORTED_IMAGE_EXTENSIONS:
        for chart_file in data_path.glob(f"*{ext}"):
            charts.append({
                "name": chart_file.stem,
                "filename": chart_file.name,
                "path": str(chart_file),
                "format": ext[1:]
            })
    
    return charts
