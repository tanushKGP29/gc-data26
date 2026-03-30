import json
import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import xgboost as xgb

# Paths
BACKEND_DIR = Path(__file__).parent
AGENT_DIR = BACKEND_DIR.parent
PROJECT_DIR = AGENT_DIR.parent

# Data dir lives at the project root (not inside backend/)
DEFAULT_DATA_DIR = PROJECT_DIR / "data"
DEFAULT_MODEL_DIR = DEFAULT_DATA_DIR / "models" / "lift"

# Cached artifacts
_cached_model: Optional[xgb.XGBClassifier] = None
_cached_columns: Optional[List[str]] = None
_cached_metadata: Optional[Dict[str, Any]] = None


# ── Preprocessing helpers ──

def _extract_country(region: Any) -> str:
    if pd.isna(region):
        return "unknown"
    parts = str(region).split(",")
    return parts[-1].strip().lower() if parts else str(region).lower()


def preprocess_training_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, float, List[str]]:
    df_proc = df.copy()
    # Safety fills
    for col in ["platforms", "topic", "region", "language", "hashtags"]:
        if col not in df_proc:
            df_proc[col] = "unknown"
        df_proc[col] = df_proc[col].fillna("unknown")

    # Target
    if "likes" not in df_proc:
        raise ValueError("Column 'likes' is required to build the target")
    threshold = df_proc["likes"].quantile(0.75)
    df_proc["Target_Lift"] = (df_proc["likes"] >= threshold).astype(int)

    # Drop leakage / ids
    drop_cols = [c for c in ["likes", "video_number"] if c in df_proc]
    if drop_cols:
        df_proc = df_proc.drop(columns=drop_cols)

    # Hashtag count
    df_proc["hashtag_count"] = df_proc["hashtags"].apply(
        lambda x: len(str(x).split(",")) if pd.notnull(x) else 0
    )
    df_proc = df_proc.drop(columns=["hashtags"], errors="ignore")

    # Country from region
    df_proc["country"] = df_proc["region"].apply(_extract_country)
    df_proc = df_proc.drop(columns=["region"], errors="ignore")

    # One-hot
    categorical_cols = [c for c in ["platforms", "topic", "country", "language"] if c in df_proc]
    df_proc = pd.get_dummies(df_proc, columns=categorical_cols)

    # Ensure engagement_score exists
    if "engagement_score" not in df_proc:
        df_proc["engagement_score"] = 0.0

    # Preserve platform values for optimizer
    platform_values = sorted(set(df["platforms"].dropna().astype(str).str.lower().unique())) if "platforms" in df else []

    return df_proc, threshold, platform_values


def _make_feature_row(video: Dict[str, Any], feature_columns: List[str], platform: str) -> Dict[str, float]:
    row = {col: 0 for col in feature_columns}

    row["engagement_score"] = float(video.get("engagement_score", 0))
    hashtags = video.get("hashtags") or []
    row["hashtag_count"] = len(hashtags)

    topic_col = f"topic_{str(video.get('topic', 'unknown')).lower()}"
    if topic_col in row:
        row[topic_col] = 1

    country = _extract_country(video.get("region", "unknown"))
    country_col = f"country_{country}"
    if country_col in row:
        row[country_col] = 1

    lang_col = f"language_{str(video.get('language', 'unknown')).lower()}"
    if lang_col in row:
        row[lang_col] = 1

    plat_col = f"platforms_{platform}"
    if plat_col in row:
        row[plat_col] = 1

    return row


# ── Training ──

def train_lift_model(
    csv_path: Path,
    model_dir: Path = DEFAULT_MODEL_DIR,
    test_size: float = 0.2,
    random_state: int = 42,
    n_estimators: int = 150,
    learning_rate: float = 0.05,
    max_depth: int = 6,
) -> Dict[str, Any]:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found: {csv_path}")

    df = pd.read_csv(csv_path)
    processed, threshold, platform_values = preprocess_training_data(df)

    X = processed.drop(columns=["Target_Lift"], errors="ignore")
    y = processed["Target_Lift"]
    feature_columns = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        max_depth=max_depth,
        eval_metric="logloss",
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=random_state,
        use_label_encoder=False,
    )
    model.fit(X_train, y_train)

    auc = float(roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]))

    model_dir.mkdir(parents=True, exist_ok=True)
    with open(model_dir / "model.pkl", "wb") as f:
        pickle.dump(model, f)
    (model_dir / "training_columns.json").write_text(json.dumps(feature_columns), encoding="utf-8")
    metadata = {
        "threshold": threshold,
        "platform_values": platform_values,
        "auc": auc,
        "training_rows": int(len(df)),
        "training_path": str(csv_path),
    }
    (model_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    # cache
    global _cached_model, _cached_columns, _cached_metadata
    _cached_model = model
    _cached_columns = feature_columns
    _cached_metadata = metadata

    return {
        "auc": auc,
        "threshold": threshold,
        "feature_count": len(feature_columns),
        "platform_values": platform_values,
        "model_dir": str(model_dir),
    }


# ── Load ──

def load_lift_artifacts(model_dir: Path = DEFAULT_MODEL_DIR) -> Tuple[xgb.XGBClassifier, List[str], Dict[str, Any]]:
    global _cached_model, _cached_columns, _cached_metadata
    if _cached_model is not None and _cached_columns is not None and _cached_metadata is not None:
        return _cached_model, _cached_columns, _cached_metadata

    model_path = model_dir / "model.pkl"
    cols_path = model_dir / "training_columns.json"
    meta_path = model_dir / "metadata.json"
    if not model_path.exists() or not cols_path.exists() or not meta_path.exists():
        raise FileNotFoundError("Lift model artifacts not found. Train first.")

    with open(model_path, "rb") as f:
        model = pickle.load(f)
    feature_columns = json.loads(cols_path.read_text(encoding="utf-8"))
    metadata = json.loads(meta_path.read_text(encoding="utf-8"))

    _cached_model, _cached_columns, _cached_metadata = model, feature_columns, metadata
    return model, feature_columns, metadata


# ── Scoring ──

def score_video(video: Dict[str, Any], model_dir: Path = DEFAULT_MODEL_DIR) -> Dict[str, Any]:
    model, feature_columns, metadata = load_lift_artifacts(model_dir)
    platforms = metadata.get("platform_values") or []
    if not platforms:
        raise ValueError("No platform values found in metadata; retrain model with platforms present.")

    scenarios = []
    for platform in platforms:
        row = _make_feature_row(video, feature_columns, platform)
        scenarios.append((platform, row))

    test_df = pd.DataFrame([s[1] for s in scenarios])
    probs = model.predict_proba(test_df)[:, 1]
    best_idx = int(np.argmax(probs))
    return {
        "best_platform": scenarios[best_idx][0],
        "probability": float(probs[best_idx]),
        "rankings": [
            {"platform": scenarios[i][0], "probability": float(probs[i])}
            for i in range(len(scenarios))
        ],
        "meta": metadata,
    }


def score_dataset(df: pd.DataFrame, model_dir: Path = DEFAULT_MODEL_DIR) -> Dict[str, Any]:
    model, feature_columns, metadata = load_lift_artifacts(model_dir)
    processed, _, _ = preprocess_training_data(df)
    X = processed.drop(columns=["Target_Lift"], errors="ignore")
    # Align columns
    for col in feature_columns:
        if col not in X:
            X[col] = 0
    X = X[feature_columns]
    probs = model.predict_proba(X)[:, 1]
    return {
        "probabilities": probs.tolist(),
        "meta": metadata,
    }


# ── Utilities ──

def resolve_dataset_path(name: str) -> Path:
    candidate_names = [name, f"{name}.csv"] if not name.lower().endswith(".csv") else [name]
    search_dirs = [DEFAULT_DATA_DIR, DEFAULT_DATA_DIR / "datasets", DEFAULT_DATA_DIR / "datasets" / "uploads"]
    for candidate in candidate_names:
        for d in search_dirs:
            p = d / candidate
            if p.exists():
                return p
    raise FileNotFoundError(f"Dataset '{name}' not found in data/, data/datasets/, or data/datasets/uploads/")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train lift model")
    parser.add_argument("csv", help="Path to dataset CSV")
    parser.add_argument("--out", help="Model output directory", default=str(DEFAULT_MODEL_DIR))
    args = parser.parse_args()

    result = train_lift_model(Path(args.csv), Path(args.out))
    print(json.dumps(result, indent=2))
