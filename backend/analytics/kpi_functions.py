"""
KPI Functions - Individual computation functions for each KPI.

FUNCTION SIGNATURE:
    fn(datasets: Dict[str, pd.DataFrame], columns: Dict[str, str] = None) -> value

    - datasets: Dict mapping dataset role names to DataFrames
                e.g., {"channel_summary": df1, "monthly": df2}
    
    - columns: Dict mapping semantic column names to actual column names
               e.g., {"uploaded_count": "Uploaded Count", "created_count": "Created Count"}
               If not provided or key missing, uses default from function.

Each function has:
- Clear docstring with input/output spec
- Default column names (fallback if not provided)
- Support for multiple datasets if needed

Functions are registered in KPI_FUNCTION_REGISTRY and referenced by name in kpi_registry.json.
"""
import pandas as pd
import numpy as np
from typing import Any, Dict, Optional, Callable, Union
import logging

logger = logging.getLogger("analytics.kpi_functions")


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def parse_duration_to_seconds(series: pd.Series) -> pd.Series:
    """
    Parse duration strings in hh:mm:ss format to total seconds.
    
    Handles:
    - Standard format: "01:30:45" -> 5445 seconds
    - Hours > 99: "150:30:00" -> 541800 seconds
    - Minutes only: "30:45" -> 1845 seconds
    - Invalid/empty values -> 0
    """
    def _parse(s):
        try:
            s = str(s).strip()
            if not s or s == "nan" or s == "NaT":
                return 0
            parts = s.split(":")
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            elif len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            return 0
        except Exception:
            return 0
    return series.apply(_parse)


def get_col(columns: Dict[str, str], key: str, default: str) -> str:
    """Get column name from mapping, falling back to default."""
    if columns is None:
        return default
    return columns.get(key, default)


def get_df(datasets: Dict[str, pd.DataFrame], key: str) -> Optional[pd.DataFrame]:
    """Get DataFrame from datasets dict."""
    return datasets.get(key)


def safe_sum(df: pd.DataFrame, col: str) -> float:
    """Safely sum a column, handling missing columns and non-numeric values."""
    if df is None or col not in df.columns:
        return 0
    return float(pd.to_numeric(df[col], errors="coerce").sum())


def safe_divide(numerator: float, denominator: float, default: float = 0) -> float:
    """Safely divide two numbers, returning default if denominator is 0."""
    if denominator == 0:
        return default
    return numerator / denominator


# ═══════════════════════════════════════════════════════════════════════════════
# VOLUME KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_total_uploaded(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> int:
    """
    Total Uploaded Videos
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"uploaded_count": "actual_column_name"}
    
    Defaults:
        uploaded_count -> "Uploaded Count"
    
    Output: Integer - Sum of uploaded_count across all rows
    Formula: SUM(uploaded_count)
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "uploaded_count", "Uploaded Count")
    return int(safe_sum(df, col))


def compute_total_processed(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> int:
    """
    Total Processed/Created Clips
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"created_count": "actual_column_name"}
    
    Defaults:
        created_count -> "Created Count"
    
    Output: Integer - Sum of created_count across all rows
    Formula: SUM(created_count)
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "created_count", "Created Count")
    return int(safe_sum(df, col))


def compute_total_published(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> int:
    """
    Total Published Clips
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"published_count": "actual_column_name"}
    
    Defaults:
        published_count -> "Published Count"
    
    Output: Integer - Sum of published_count across all rows
    Formula: SUM(published_count)
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "published_count", "Published Count")
    return int(safe_sum(df, col))


def compute_distinct_channels(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> int:
    """
    Distinct Channel Count
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"channel_name": "actual_column_name"}
    
    Defaults:
        channel_name -> "Channel"
    
    Output: Integer - Count of unique channel_name values
    Formula: COUNT_DISTINCT(channel_name)
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "channel_name", "Channel")
    if df is None or col not in df.columns:
        return 0
    return int(df[col].nunique())


def compute_distinct_users(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> int:
    """
    Distinct User Count
    
    Input:
        datasets: {"user_summary": DataFrame}
        columns: {"user_name": "actual_column_name"}
    
    Defaults:
        user_name -> "User"
    
    Output: Integer - Count of unique user_name values
    Formula: COUNT_DISTINCT(user_name)
    """
    df = get_df(datasets, "user_summary")
    col = get_col(columns, "user_name", "User")
    if df is None or col not in df.columns:
        return 0
    return int(df[col].nunique())


# ═══════════════════════════════════════════════════════════════════════════════
# CONVERSION KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_publish_rate(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Publish Rate (Conversion Rate)
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {
            "published_count": "actual_column_name",
            "created_count": "actual_column_name"
        }
    
    Defaults:
        published_count -> "Published Count"
        created_count -> "Created Count"
    
    Output: Float - Percentage (0-100)
    Formula: (SUM(published_count) / SUM(created_count)) * 100
    """
    df = get_df(datasets, "channel_summary")
    published_col = get_col(columns, "published_count", "Published Count")
    created_col = get_col(columns, "created_count", "Created Count")
    
    total_published = safe_sum(df, published_col)
    total_created = safe_sum(df, created_col)
    
    return round(safe_divide(total_published, total_created) * 100, 2)


def compute_top_performing_channel(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Top Performing Channel by Publish Rate
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {
            "channel_name": "actual_column_name",
            "created_count": "actual_column_name",
            "published_count": "actual_column_name"
        }
    
    Defaults:
        channel_name -> "Channel"
        created_count -> "Created Count"
        published_count -> "Published Count"
    
    Output: String - "ChannelName (XX.XX%)"
    Formula: channel_name WHERE MAX(published_count / created_count)
    """
    df = get_df(datasets, "channel_summary")
    if df is None:
        return ""
    
    channel_col = get_col(columns, "channel_name", "Channel")
    created_col = get_col(columns, "created_count", "Created Count")
    published_col = get_col(columns, "published_count", "Published Count")
    
    if channel_col not in df.columns:
        return ""
    
    df_c = df.copy()
    df_c["_created_num"] = pd.to_numeric(df_c.get(created_col, pd.Series()), errors="coerce")
    df_c["_published_num"] = pd.to_numeric(df_c.get(published_col, pd.Series()), errors="coerce")
    df_c["_pr"] = df_c["_published_num"] / df_c["_created_num"].replace(0, float("nan"))
    
    valid = df_c.dropna(subset=["_pr"])
    if len(valid) == 0:
        return ""
    
    top_row = valid.loc[valid["_pr"].idxmax()]
    top_ch = str(top_row[channel_col])
    top_rate = round(float(top_row["_pr"] * 100), 2)
    return f"{top_ch} ({top_rate}%)"


# ═══════════════════════════════════════════════════════════════════════════════
# EFFICIENCY KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_amplification_ratio(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Amplification Ratio
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {
            "created_count": "actual_column_name",
            "uploaded_count": "actual_column_name"
        }
    
    Defaults:
        created_count -> "Created Count"
        uploaded_count -> "Uploaded Count"
    
    Output: Float - Ratio (e.g., 3.35 = 3.35 clips per upload)
    Formula: SUM(created_count) / SUM(uploaded_count)
    """
    df = get_df(datasets, "channel_summary")
    created_col = get_col(columns, "created_count", "Created Count")
    uploaded_col = get_col(columns, "uploaded_count", "Uploaded Count")
    
    total_created = safe_sum(df, created_col)
    total_uploaded = safe_sum(df, uploaded_col)
    
    return round(safe_divide(total_created, total_uploaded), 2)


def compute_process_rate(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Process Rate (as percentage)
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {
            "created_count": "actual_column_name",
            "uploaded_count": "actual_column_name"
        }
    
    Defaults:
        created_count -> "Created Count"
        uploaded_count -> "Uploaded Count"
    
    Output: Float - Percentage
    Formula: (SUM(created_count) / SUM(uploaded_count)) * 100
    """
    df = get_df(datasets, "channel_summary")
    created_col = get_col(columns, "created_count", "Created Count")
    uploaded_col = get_col(columns, "uploaded_count", "Uploaded Count")
    
    total_created = safe_sum(df, created_col)
    total_uploaded = safe_sum(df, uploaded_col)
    
    return round(safe_divide(total_created, total_uploaded) * 100, 2)


def compute_peak_upload_month(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Peak Upload Month
    
    Input:
        datasets: {"monthly": DataFrame}
        columns: {
            "month_label": "actual_column_name",
            "monthly_uploaded": "actual_column_name"
        }
    
    Defaults:
        month_label -> "Month"
        monthly_uploaded -> "Total Uploaded"
    
    Output: String - Month label (e.g., "Apr, 2025")
    Formula: month_label WHERE MAX(monthly_uploaded)
    """
    df = get_df(datasets, "monthly")
    if df is None:
        return ""
    
    month_col = get_col(columns, "month_label", "Month")
    uploaded_col = get_col(columns, "monthly_uploaded", "Total Uploaded")
    
    if month_col not in df.columns or uploaded_col not in df.columns:
        return ""
    
    df_copy = df.copy()
    df_copy["_num"] = pd.to_numeric(df_copy[uploaded_col], errors="coerce")
    
    if df_copy["_num"].sum() == 0:
        return ""
    
    max_row = df_copy.loc[df_copy["_num"].idxmax()]
    return str(max_row[month_col])


# ═══════════════════════════════════════════════════════════════════════════════
# DURATION KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_uploaded_hours(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Total Uploaded Hours
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"uploaded_duration": "actual_column_name"}
    
    Defaults:
        uploaded_duration -> "Uploaded Duration (hh:mm:ss)"
    
    Output: Float - Hours
    Formula: SUM(parse_duration(uploaded_duration)) / 3600
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "uploaded_duration", "Uploaded Duration (hh:mm:ss)")
    if df is None or col not in df.columns:
        return 0
    
    total_seconds = parse_duration_to_seconds(df[col]).sum()
    return round(total_seconds / 3600, 2)


def compute_processed_hours(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Total Processed Hours
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"created_duration": "actual_column_name"}
    
    Defaults:
        created_duration -> "Created Duration (hh:mm:ss)"
    
    Output: Float - Hours
    Formula: SUM(parse_duration(created_duration)) / 3600
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "created_duration", "Created Duration (hh:mm:ss)")
    if df is None or col not in df.columns:
        return 0
    
    total_seconds = parse_duration_to_seconds(df[col]).sum()
    return round(total_seconds / 3600, 2)


def compute_published_hours(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Total Published Hours
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"published_duration": "actual_column_name"}
    
    Defaults:
        published_duration -> "Published Duration (hh:mm:ss)"
    
    Output: Float - Hours
    Formula: SUM(parse_duration(published_duration)) / 3600
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "published_duration", "Published Duration (hh:mm:ss)")
    if df is None or col not in df.columns:
        return 0
    
    total_seconds = parse_duration_to_seconds(df[col]).sum()
    return round(total_seconds / 3600, 2)


def compute_avg_upload_duration(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Average Upload Duration (in minutes)
    
    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {
            "uploaded_duration": "actual_column_name",
            "uploaded_count": "actual_column_name"
        }
    
    Defaults:
        uploaded_duration -> "Uploaded Duration (hh:mm:ss)"
        uploaded_count -> "Uploaded Count"
    
    Output: Float - Minutes
    Formula: (SUM(parse_duration(uploaded_duration)) / SUM(uploaded_count)) / 60
    """
    df = get_df(datasets, "channel_summary")
    dur_col = get_col(columns, "uploaded_duration", "Uploaded Duration (hh:mm:ss)")
    count_col = get_col(columns, "uploaded_count", "Uploaded Count")
    
    if df is None or dur_col not in df.columns or count_col not in df.columns:
        return 0
    
    total_seconds = parse_duration_to_seconds(df[dur_col]).sum()
    total_count = safe_sum(df, count_col)
    
    if total_count == 0:
        return 0
    
    avg_seconds = total_seconds / total_count
    return round(avg_seconds / 60, 2)


# ═══════════════════════════════════════════════════════════════════════════════
# CONTENT MIX KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_top_output_type(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Top Output Type - output type with highest created count.

    Input:
        datasets: {"output_type": DataFrame}
        columns: {"output_type_name": "actual_col", "created_count": "actual_col"}

    Defaults:
        output_type_name -> "Output Type"
        created_count -> "Created Count"

    Output: String - output type name
    Formula: output_type WHERE MAX(created_count)
    """
    df = get_df(datasets, "output_type")
    name_col = get_col(columns, "output_type_name", "Output Type")
    count_col = get_col(columns, "created_count", "Created Count")
    if df is None or name_col not in df.columns or count_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)
    if df.empty:
        return "N/A"
    idx = df[count_col].idxmax()
    return str(df.loc[idx, name_col])


def compute_top_input_type(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Top Input Type - input type with highest uploaded count.

    Input:
        datasets: {"input_type": DataFrame}
        columns: {"input_type_name": "actual_col", "uploaded_count": "actual_col"}

    Defaults:
        input_type_name -> "Input Type"
        uploaded_count -> "Uploaded Count"

    Output: String - input type name
    Formula: input_type WHERE MAX(uploaded_count)
    """
    df = get_df(datasets, "input_type")
    name_col = get_col(columns, "input_type_name", "Input Type")
    count_col = get_col(columns, "uploaded_count", "Uploaded Count")
    if df is None or name_col not in df.columns or count_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)
    if df.empty:
        return "N/A"
    idx = df[count_col].idxmax()
    return str(df.loc[idx, name_col])


def compute_language_count(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> int:
    """
    Language Count - number of distinct languages in the dataset.

    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"language": "actual_col"}

    Defaults:
        language -> "Language"

    Output: Integer - count of unique languages
    Formula: COUNT_DISTINCT(language)
    """
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "language", "Language")
    if df is None or col not in df.columns:
        return 0
    return int(df[col].dropna().nunique())


# ═══════════════════════════════════════════════════════════════════════════════
# ADDITIONAL CONVERSION KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_bottom_performing_channel(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Lowest Performing Channel - channel with lowest publish rate (published/created).

    Input:
        datasets: {"channel_summary": DataFrame}
        columns: {"channel_name": "actual_col", "published_count": "actual_col", "created_count": "actual_col"}

    Defaults:
        channel_name -> "Channel"
        published_count -> "Published Count"
        created_count -> "Created Count"

    Output: String - "ChannelName (XX.XX%)"
    Formula: channel WHERE MIN(published/created)
    """
    df = get_df(datasets, "channel_summary")
    ch_col = get_col(columns, "channel_name", "Channel")
    pub_col = get_col(columns, "published_count", "Published Count")
    cr_col = get_col(columns, "created_count", "Created Count")
    if df is None or ch_col not in df.columns or pub_col not in df.columns or cr_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[pub_col] = pd.to_numeric(df[pub_col], errors="coerce").fillna(0)
    df[cr_col] = pd.to_numeric(df[cr_col], errors="coerce").fillna(0)
    df = df[df[cr_col] > 0]
    if df.empty:
        return "N/A"
    df["_rate"] = df[pub_col] / df[cr_col] * 100
    idx = df["_rate"].idxmin()
    return f"{df.loc[idx, ch_col]} ({df.loc[idx, '_rate']:.2f}%)"


def compute_output_type_publish_rate(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Best Output Type Publish Rate - output type with highest published/created ratio.

    Input:
        datasets: {"output_type": DataFrame}
        columns: {"output_type_name": "actual_col", "published_count": "actual_col", "created_count": "actual_col"}

    Defaults:
        output_type_name -> "Output Type"
        published_count -> "Published Count"
        created_count -> "Created Count"

    Output: String - "TypeName (XX.XX%)"
    Formula: MAX(published/created) by output_type
    """
    df = get_df(datasets, "output_type")
    name_col = get_col(columns, "output_type_name", "Output Type")
    pub_col = get_col(columns, "published_count", "Published Count")
    cr_col = get_col(columns, "created_count", "Created Count")
    if df is None or name_col not in df.columns or pub_col not in df.columns or cr_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[pub_col] = pd.to_numeric(df[pub_col], errors="coerce").fillna(0)
    df[cr_col] = pd.to_numeric(df[cr_col], errors="coerce").fillna(0)
    df = df[df[cr_col] > 0]
    if df.empty:
        return "N/A"
    df["_rate"] = df[pub_col] / df[cr_col] * 100
    idx = df["_rate"].idxmax()
    return f"{df.loc[idx, name_col]} ({df.loc[idx, '_rate']:.2f}%)"


# ═══════════════════════════════════════════════════════════════════════════════
# GROWTH KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_mom_upload_growth(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> float:
    """
    Month-over-Month Upload Growth - percentage change between last two months.

    Input:
        datasets: {"monthly": DataFrame}
        columns: {"monthly_uploaded": "actual_col"}

    Defaults:
        monthly_uploaded -> "Total Uploaded"

    Output: Float - percentage growth
    Formula: ((last_month - prev_month) / prev_month) * 100
    """
    df = get_df(datasets, "monthly")
    col = get_col(columns, "monthly_uploaded", "Total Uploaded")
    if df is None or col not in df.columns or len(df) < 2:
        return 0.0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0).tolist()
    last = vals[-1]
    prev = vals[-2]
    if prev == 0:
        return 0.0
    return round(((last - prev) / prev) * 100, 2)


def compute_peak_publish_month(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Peak Publish Month - month with the highest number of published clips.

    Input:
        datasets: {"monthly": DataFrame}
        columns: {"month_label": "actual_col", "monthly_published": "actual_col"}

    Defaults:
        month_label -> "Month"
        monthly_published -> "Total Published"

    Output: String - month label
    Formula: month WHERE MAX(published)
    """
    df = get_df(datasets, "monthly")
    month_col = get_col(columns, "month_label", "Month")
    pub_col = get_col(columns, "monthly_published", "Total Published")
    if df is None or month_col not in df.columns or pub_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[pub_col] = pd.to_numeric(df[pub_col], errors="coerce").fillna(0)
    if df.empty:
        return "N/A"
    idx = df[pub_col].idxmax()
    return str(df.loc[idx, month_col])


# ═══════════════════════════════════════════════════════════════════════════════
# PLATFORM KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_top_platform(
    datasets: Dict[str, pd.DataFrame],
    columns: Dict[str, str] = None
) -> str:
    """
    Top Platform - platform with the highest total published count.

    Input:
        datasets: {"channel_platform": DataFrame}
        columns: {"channel_name": "actual_col"}

    The channel_platform dataset has channel_name + one column per platform.
    We sum each platform column and return the one with the highest total.

    Output: String - "PlatformName (count)"
    Formula: platform WHERE MAX(count)
    """
    df = get_df(datasets, "channel_platform")
    if df is None or df.empty:
        return "N/A"
    ch_col = get_col(columns, "channel_name", "Channel")
    # Sum all numeric columns except channel_name
    numeric_cols = [c for c in df.columns if c != ch_col]
    totals = {}
    for c in numeric_cols:
        totals[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).sum()
    if not totals:
        return "N/A"
    best = max(totals, key=totals.get)
    return f"{best} ({int(totals[best])})"


# ═══════════════════════════════════════════════════════════════════════════════
# NEW KPIs - Phase 2
# ═══════════════════════════════════════════════════════════════════════════════

def compute_publish_dropoff(datasets, columns=None):
    """Publish Drop-off: SUM(created) - SUM(published)."""
    df = get_df(datasets, "channel_summary")
    cr = safe_sum(df, get_col(columns, "created_count", "Created Count"))
    pub = safe_sum(df, get_col(columns, "published_count", "Published Count"))
    return int(cr - pub)


def compute_zero_pub_channel_count(datasets, columns=None):
    """Count of channels with zero published clips."""
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "published_count", "Published Count")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals == 0).sum())


def compute_active_channel_count(datasets, columns=None):
    """Count of channels with at least one upload."""
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "uploaded_count", "Uploaded Count")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals > 0).sum())


def compute_publishing_channel_count(datasets, columns=None):
    """Count of channels that have published at least one clip."""
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "published_count", "Published Count")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals > 0).sum())


def compute_zero_pub_month_count(datasets, columns=None):
    """Count of months with zero published output."""
    df = get_df(datasets, "monthly")
    col = get_col(columns, "monthly_published", "Total Published")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals == 0).sum())


def compute_mom_created_growth(datasets, columns=None):
    """Month-over-month created growth percentage."""
    df = get_df(datasets, "monthly")
    col = get_col(columns, "monthly_created", "Total Created")
    if df is None or col not in df.columns or len(df) < 2:
        return 0.0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0).tolist()
    last, prev = vals[-1], vals[-2]
    if prev == 0:
        return 0.0
    return round(((last - prev) / prev) * 100, 2)


def compute_channel_publish_concentration(datasets, columns=None):
    """Percentage of total publishes from the top channel."""
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "published_count", "Published Count")
    if df is None or col not in df.columns:
        return 0.0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    total = vals.sum()
    if total == 0:
        return 0.0
    return round(float(vals.max() / total) * 100, 2)


def compute_top_user_by_created(datasets, columns=None):
    """User with the most created clips."""
    df = get_df(datasets, "user_summary")
    name_col = get_col(columns, "user_name", "User")
    count_col = get_col(columns, "created_count", "Created Count")
    if df is None or name_col not in df.columns or count_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)
    if df.empty:
        return "N/A"
    idx = df[count_col].idxmax()
    return str(df.loc[idx, name_col])


def compute_top_user_by_published(datasets, columns=None):
    """User with the most published clips."""
    df = get_df(datasets, "user_summary")
    name_col = get_col(columns, "user_name", "User")
    count_col = get_col(columns, "published_count", "Published Count")
    if df is None or name_col not in df.columns or count_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)
    if df.empty:
        return "N/A"
    idx = df[count_col].idxmax()
    return str(df.loc[idx, name_col])


def compute_zero_pub_user_count(datasets, columns=None):
    """Count of users with zero published clips."""
    df = get_df(datasets, "user_summary")
    col = get_col(columns, "published_count", "Published Count")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals == 0).sum())


def compute_top_language(datasets, columns=None):
    """Language with the most created clips."""
    df = get_df(datasets, "language")
    name_col = get_col(columns, "language_name", "Language")
    count_col = get_col(columns, "created_count", "Created Count")
    if df is None or name_col not in df.columns or count_col not in df.columns:
        return "N/A"
    df = df.copy()
    df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)
    if df.empty:
        return "N/A"
    idx = df[count_col].idxmax()
    return str(df.loc[idx, name_col])


def compute_english_publish_rate(datasets, columns=None):
    """Publish rate for English content."""
    df = get_df(datasets, "language")
    name_col = get_col(columns, "language_name", "Language")
    pub_col = get_col(columns, "published_count", "Published Count")
    cr_col = get_col(columns, "created_count", "Created Count")
    if df is None or name_col not in df.columns:
        return 0.0
    df = df.copy()
    # Find English row (case-insensitive)
    mask = df[name_col].str.lower().str.contains("english|eng|en", na=False)
    en_rows = df[mask]
    if en_rows.empty:
        return 0.0
    pub = pd.to_numeric(en_rows[pub_col], errors="coerce").fillna(0).sum()
    cr = pd.to_numeric(en_rows[cr_col], errors="coerce").fillna(0).sum()
    return round(safe_divide(pub, cr) * 100, 2)


def compute_unknown_team_rate(datasets, columns=None):
    """Percentage of videos with unknown team attribution."""
    df = get_df(datasets, "video_list")
    col = get_col(columns, "team_name", "Team")
    if df is None or col not in df.columns:
        return 0.0
    total = len(df)
    if total == 0:
        return 0.0
    unknown = df[col].isna().sum() + df[col].astype(str).str.lower().isin(["unknown", "nan", "", "none"]).sum()
    return round(float(unknown / total) * 100, 2)


def compute_null_platform_rate(datasets, columns=None):
    """Percentage of published videos missing platform info."""
    df = get_df(datasets, "video_list")
    pub_col = get_col(columns, "published_flag", "Published")
    plat_col = get_col(columns, "platform", "Platform")
    if df is None or pub_col not in df.columns:
        return 0.0
    # Filter to published videos
    pub_mask = df[pub_col].astype(str).str.lower().isin(["yes", "true", "1", "published"])
    published = df[pub_mask]
    if len(published) == 0:
        return 0.0
    if plat_col not in df.columns:
        return 100.0
    null_plat = published[plat_col].isna().sum() + published[plat_col].astype(str).str.lower().isin(["nan", "", "none", "null"]).sum()
    return round(float(null_plat / len(published)) * 100, 2)


def compute_data_quality_score(datasets, columns=None):
    """Weighted average completeness score across key fields."""
    df = get_df(datasets, "video_list")
    if df is None or df.empty:
        return 0.0
    team_col = get_col(columns, "team_name", "Team")
    plat_col = get_col(columns, "platform", "Platform")
    vtype_col = get_col(columns, "video_type", "Video Type")

    total = len(df)
    scores = []
    weights = []

    for col, w in [(team_col, 0.4), (plat_col, 0.3), (vtype_col, 0.3)]:
        if col in df.columns:
            non_null = df[col].notna().sum() - df[col].astype(str).str.lower().isin(["nan", "", "none", "unknown"]).sum()
            scores.append(max(0, non_null) / total * 100)
            weights.append(w)

    if not scores:
        return 0.0
    total_w = sum(weights)
    return round(sum(s * w for s, w in zip(scores, weights)) / total_w, 1)


# ═══════════════════════════════════════════════════════════════════════════════
# ADDITIONAL FRONTEND KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def compute_publish_gap(datasets, columns=None):
    """Publish gap percentage - percentage of content never published."""
    df = get_df(datasets, "channel_summary")
    cr = safe_sum(df, get_col(columns, "created_count", "Created Count"))
    pub = safe_sum(df, get_col(columns, "published_count", "Published Count"))
    if cr == 0:
        return 0.0
    return round((1 - pub / cr) * 100, 2)


def compute_zero_upload_users(datasets, columns=None):
    """Count of users with zero uploads."""
    df = get_df(datasets, "user_summary")
    col = get_col(columns, "uploaded_count", "Uploaded Count")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals == 0).sum())


def compute_active_users(datasets, columns=None):
    """Count of users with at least one upload."""
    df = get_df(datasets, "user_summary")
    col = get_col(columns, "uploaded_count", "Uploaded Count")
    if df is None or col not in df.columns:
        return 0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return int((vals > 0).sum())


def compute_user_concentration_top5(datasets, columns=None):
    """Percentage of total created by top 5 users."""
    df = get_df(datasets, "user_summary")
    col = get_col(columns, "created_count", "Created Count")
    if df is None or col not in df.columns:
        return 0.0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    total = vals.sum()
    if total == 0:
        return 0.0
    top5 = vals.nlargest(5).sum()
    return round(top5 / total * 100, 2)


def compute_avg_clips_per_upload(datasets, columns=None):
    """Average number of clips created per upload."""
    df = get_df(datasets, "channel_summary")
    cr = safe_sum(df, get_col(columns, "created_count", "Created Count"))
    up = safe_sum(df, get_col(columns, "uploaded_count", "Uploaded Count"))
    return round(safe_divide(cr, up), 2)


def compute_zero_pub_channel_rate(datasets, columns=None):
    """Percentage of channels with zero published clips."""
    df = get_df(datasets, "channel_summary")
    col = get_col(columns, "published_count", "Published Count")
    if df is None or col not in df.columns:
        return 0.0
    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
    total = len(vals)
    if total == 0:
        return 0.0
    zero_count = (vals == 0).sum()
    return round(zero_count / total * 100, 2)


# ═══════════════════════════════════════════════════════════════════════════════
# KPI FUNCTION REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

KPI_FUNCTION_REGISTRY: Dict[str, Callable] = {
    # Volume KPIs
    "compute_total_uploaded": compute_total_uploaded,
    "compute_total_processed": compute_total_processed,
    "compute_total_published": compute_total_published,
    "compute_distinct_channels": compute_distinct_channels,
    "compute_distinct_users": compute_distinct_users,
    
    # Conversion KPIs
    "compute_publish_rate": compute_publish_rate,
    "compute_top_performing_channel": compute_top_performing_channel,
    
    # Efficiency KPIs
    "compute_amplification_ratio": compute_amplification_ratio,
    "compute_process_rate": compute_process_rate,
    "compute_peak_upload_month": compute_peak_upload_month,
    
    # Duration KPIs
    "compute_uploaded_hours": compute_uploaded_hours,
    "compute_processed_hours": compute_processed_hours,
    "compute_published_hours": compute_published_hours,
    "compute_avg_upload_duration": compute_avg_upload_duration,

    # Content Mix KPIs
    "compute_top_output_type": compute_top_output_type,
    "compute_top_input_type": compute_top_input_type,
    "compute_language_count": compute_language_count,

    # Additional Conversion KPIs
    "compute_bottom_performing_channel": compute_bottom_performing_channel,
    "compute_output_type_publish_rate": compute_output_type_publish_rate,

    # Growth KPIs
    "compute_mom_upload_growth": compute_mom_upload_growth,
    "compute_peak_publish_month": compute_peak_publish_month,

    # Platform KPIs
    "compute_top_platform": compute_top_platform,

    # Phase 2 KPIs
    "compute_publish_dropoff": compute_publish_dropoff,
    "compute_zero_pub_channel_count": compute_zero_pub_channel_count,
    "compute_active_channel_count": compute_active_channel_count,
    "compute_publishing_channel_count": compute_publishing_channel_count,
    "compute_zero_pub_month_count": compute_zero_pub_month_count,
    "compute_mom_created_growth": compute_mom_created_growth,
    "compute_channel_publish_concentration": compute_channel_publish_concentration,
    "compute_top_user_by_created": compute_top_user_by_created,
    "compute_top_user_by_published": compute_top_user_by_published,
    "compute_zero_pub_user_count": compute_zero_pub_user_count,
    "compute_top_language": compute_top_language,
    "compute_english_publish_rate": compute_english_publish_rate,
    "compute_unknown_team_rate": compute_unknown_team_rate,
    "compute_null_platform_rate": compute_null_platform_rate,
    "compute_data_quality_score": compute_data_quality_score,

    # Frontend-specific KPIs
    "compute_publish_gap": compute_publish_gap,
    "compute_zero_upload_users": compute_zero_upload_users,
    "compute_active_users": compute_active_users,
    "compute_user_concentration_top5": compute_user_concentration_top5,
    "compute_avg_clips_per_upload": compute_avg_clips_per_upload,
    "compute_zero_pub_channel_rate": compute_zero_pub_channel_rate,
}


def get_kpi_function(function_name: str) -> Optional[Callable]:
    """Get a KPI computation function by name."""
    return KPI_FUNCTION_REGISTRY.get(function_name)


def register_kpi_function(name: str, func: Callable) -> None:
    """Register a new KPI function at runtime."""
    KPI_FUNCTION_REGISTRY[name] = func
    logger.info(f"Registered new KPI function: {name}")


def list_kpi_functions() -> list:
    """List all available KPI function names."""
    return list(KPI_FUNCTION_REGISTRY.keys())


def get_kpi_function_info(function_name: str) -> Optional[Dict[str, str]]:
    """Get info about a KPI function from its docstring."""
    func = KPI_FUNCTION_REGISTRY.get(function_name)
    if func and func.__doc__:
        return {
            "name": function_name,
            "docstring": func.__doc__.strip()
        }
    return None
