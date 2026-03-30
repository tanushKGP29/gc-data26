"""
KPI Registry Tool — shared knowledge base for all agents.

Loads kpi_registry.json at startup and provides retrieval, search,
and fuzzy matching against the full KPI catalog.

Search modes (controlled by USE_SEMANTIC_SEARCH env var):
  True (default) — FAISS vector DB + sentence-transformers:
    - Embeds each KPI (name + description + formula) at startup
    - At query time: embed query → FAISS cosine similarity → top N
    - Rebuilds on reload_registry() or new session reset
  False — Multi-signal heuristic scoring only:
    - Exact ID/name match, alias/abbreviation, substring, bigram, token overlap
"""
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from llm.groq_client import fast_complete

logger = logging.getLogger("kpi_registry_tool")

_REGISTRY_PATH = Path(__file__).parent / "analytics" / "kpi_registry.json"

# ── Config ──
USE_SEMANTIC_SEARCH = os.getenv("USE_SEMANTIC_SEARCH", "true").lower() in ("1", "true", "yes")

# ── In-memory KPI database ──
KPI_DB: List[Dict[str, Any]] = []
KPI_LOOKUP: Dict[str, Dict[str, Any]] = {}
KPI_CATEGORIES: Dict[str, List[Dict[str, Any]]] = {}
KPI_SEARCH_TEXT: Dict[str, str] = {}
KPI_ALIASES: Dict[str, str] = {}  # alias → kpi_id
_REGISTRY_CONTEXT_CACHE: Optional[str] = None

# ── FAISS vector store ──
_FAISS_INDEX = None       # faiss.IndexFlatIP
_EMBEDDER = None          # SentenceTransformer model instance
_KPI_IDS_ORDER: List[str] = []  # maps FAISS row index → kpi_id


def _load_embedder():
    """Load sentence-transformers model (small, fast, ~80MB). Cached after first call."""
    global _EMBEDDER
    if _EMBEDDER is not None:
        return _EMBEDDER
    try:
        from sentence_transformers import SentenceTransformer
        _EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded: all-MiniLM-L6-v2")
        return _EMBEDDER
    except Exception as e:
        logger.warning(f"Could not load embedding model, semantic search disabled: {e}")
        return None


def _build_faiss_index():
    """Build FAISS index from all KPIs. Called at startup and on reload."""
    global _FAISS_INDEX, _KPI_IDS_ORDER

    _FAISS_INDEX = None
    _KPI_IDS_ORDER = []

    if not KPI_DB:
        return

    embedder = _load_embedder()
    if embedder is None:
        return

    try:
        import faiss
        import numpy as np
    except ImportError as e:
        logger.warning(f"FAISS not available, semantic search disabled: {e}")
        return

    # Build rich text for each KPI entity
    texts = []
    ids = []
    for kpi in KPI_DB:
        parts = [kpi["name"], kpi["description"]]
        if kpi["formula"]:
            parts.append(f"Formula: {kpi['formula']}")
        if kpi["category"]:
            parts.append(f"Category: {kpi['category']}")
        if kpi.get("interpretation"):
            interp = kpi["interpretation"]
            if isinstance(interp, dict):
                parts.append(" ".join(str(v) for v in interp.values())[:200])
            elif isinstance(interp, str):
                parts.append(interp[:200])
        texts.append(". ".join(parts))
        ids.append(kpi["id"])

    # Encode all KPIs
    embeddings = embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    embeddings = np.array(embeddings, dtype=np.float32)

    # Build FAISS index (Inner Product on normalized vectors = cosine similarity)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    _FAISS_INDEX = index
    _KPI_IDS_ORDER = ids
    logger.info(f"FAISS index built: {len(ids)} KPIs, dim={dim}")


def _vector_search(query: str, top_n: int = 5) -> List[Dict[str, Any]]:
    """Search FAISS index for semantically similar KPIs."""
    if _FAISS_INDEX is None or _EMBEDDER is None or not _KPI_IDS_ORDER:
        return []

    try:
        import numpy as np
    except ImportError:
        return []

    # Embed query
    query_vec = _EMBEDDER.encode([query], normalize_embeddings=True, show_progress_bar=False)
    query_vec = np.array(query_vec, dtype=np.float32)

    # Search FAISS
    k = min(top_n, len(_KPI_IDS_ORDER))
    scores, indices = _FAISS_INDEX.search(query_vec, k)

    results = []
    for i in range(k):
        idx = int(indices[0][i])
        sim = float(scores[0][i])
        if idx < 0 or sim < 0.15:  # skip invalid or very weak matches
            continue
        kpi_id = _KPI_IDS_ORDER[idx]
        if kpi_id not in KPI_LOOKUP:
            continue
        entry = KPI_LOOKUP[kpi_id].copy()
        entry["relevance_score"] = round(sim * 20, 2)  # scale to 0-20 for consistency
        entry["similarity"] = round(sim, 4)
        results.append(entry)

    return results


def reset_vector_store():
    """Clear and rebuild the FAISS index. Call on new session or registry change."""
    global _FAISS_INDEX, _KPI_IDS_ORDER
    _FAISS_INDEX = None
    _KPI_IDS_ORDER = []
    if USE_SEMANTIC_SEARCH:
        _build_faiss_index()
    logger.info("Vector store reset and rebuilt")


# ── Alias / heuristic helpers ──

def _build_aliases(kpi_id: str, name: str) -> List[str]:
    """Generate abbreviations and common aliases from a KPI name."""
    aliases = []
    words = name.split()

    # Acronym from first letters (e.g., "Viral Velocity Score" → "vvs")
    if len(words) >= 2:
        acronym = "".join(w[0].lower() for w in words if w[0].isalpha())
        if len(acronym) >= 2:
            aliases.append(acronym)

    # Common short forms: drop trailing generic words
    generic_tails = {"score", "index", "rate", "ratio", "count", "total"}
    if len(words) >= 3 and words[-1].lower() in generic_tails:
        aliases.append(" ".join(words[:-1]).lower())

    # ID without underscores as alias
    aliases.append(kpi_id.replace("_", " "))

    return aliases


def _bigrams(text: str) -> Set[str]:
    """Generate character bigrams for fuzzy substring matching."""
    t = text.lower().replace("_", " ")
    return {t[i:i+2] for i in range(len(t) - 1)} if len(t) >= 2 else set()


# ── Init ──

def _init_kpi_db():
    """Parse kpi_registry.json and build in-memory indexes + FAISS vector store."""
    global KPI_DB, KPI_LOOKUP, KPI_CATEGORIES, KPI_SEARCH_TEXT, KPI_ALIASES, _REGISTRY_CONTEXT_CACHE
    global _FAISS_INDEX, _KPI_IDS_ORDER

    # Reset all indexes
    KPI_DB = []
    KPI_LOOKUP = {}
    KPI_CATEGORIES = {}
    KPI_SEARCH_TEXT = {}
    KPI_ALIASES = {}
    _REGISTRY_CONTEXT_CACHE = None
    _FAISS_INDEX = None
    _KPI_IDS_ORDER = []

    try:
        raw = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Failed to load KPI registry: {e}")
        return

    for kpi in raw.get("kpis", []):
        entry = {
            "id": kpi.get("id", ""),
            "name": kpi.get("name", ""),
            "description": kpi.get("description", ""),
            "category": kpi.get("category", ""),
            "formula": kpi.get("formula", ""),
            "unit": kpi.get("unit", ""),
            "format": kpi.get("format", ""),
            "level": kpi.get("level", []),
            "function": kpi.get("function", ""),
            "datasets": [d for d in (kpi.get("input", {}).get("datasets", []))],
        }

        if kpi.get("interpretation"):
            entry["interpretation"] = kpi["interpretation"]
        if kpi.get("note"):
            entry["note"] = kpi["note"]

        KPI_DB.append(entry)
        KPI_LOOKUP[entry["id"]] = entry

        cat = entry["category"]
        if cat not in KPI_CATEGORIES:
            KPI_CATEGORIES[cat] = []
        KPI_CATEGORIES[cat].append(entry)

        # Precompute search text for heuristic scoring
        search_parts = [
            entry["id"].replace("_", " "),
            entry["name"].lower(),
            entry["description"].lower(),
            entry["formula"].lower(),
            entry["category"],
            entry["unit"],
        ]
        KPI_SEARCH_TEXT[entry["id"]] = " ".join(search_parts)

        # Build alias index
        for alias in _build_aliases(entry["id"], entry["name"]):
            KPI_ALIASES[alias.lower()] = entry["id"]

    logger.info(f"KPI registry loaded: {len(KPI_DB)} KPIs, {len(KPI_ALIASES)} aliases, {len(KPI_CATEGORIES)} categories")

    # Build FAISS vector store
    if USE_SEMANTIC_SEARCH:
        try:
            _build_faiss_index()
        except Exception as e:
            logger.warning(f"FAISS index build failed, will use heuristic search: {e}")


# Initialize on module load
_init_kpi_db()


def reload_registry():
    """Reload the KPI registry from disk + rebuild FAISS index."""
    _init_kpi_db()
    logger.info("KPI registry reloaded")


# ── Public API ──

def get_kpi(kpi_id: str) -> Optional[Dict[str, Any]]:
    """Get a single KPI by ID."""
    return KPI_LOOKUP.get(kpi_id)


def list_all() -> List[Dict[str, Any]]:
    """Return all KPIs."""
    return KPI_DB


def list_by_category(category: str) -> List[Dict[str, Any]]:
    """Return all KPIs in a category."""
    return KPI_CATEGORIES.get(category, [])


def _score_kpi(kpi_id: str, term_lower: str, term_tokens: Set[str], term_bigrams: Set[str]) -> float:
    """Multi-signal relevance score for a single KPI against a search term."""
    search_text = KPI_SEARCH_TEXT.get(kpi_id, "")
    kpi = KPI_LOOKUP.get(kpi_id)
    if not kpi:
        return 0.0

    score = 0.0
    kpi_name_lower = kpi["name"].lower()
    kpi_id_spaces = kpi_id.replace("_", " ")

    # Exact match on ID or name → +20
    if term_lower == kpi_id_spaces or term_lower == kpi_name_lower:
        score += 20

    # Alias match → +15
    if term_lower in KPI_ALIASES and KPI_ALIASES[term_lower] == kpi_id:
        score += 15

    # Full term as substring → +10
    if term_lower in search_text:
        score += 10

    # Individual token substring match → +3 per token
    for token in term_tokens:
        if len(token) >= 3 and token in search_text:
            score += 3

    # Bigram similarity → +5 × ratio
    if term_bigrams:
        kpi_bigrams = _bigrams(kpi_name_lower + " " + kpi["description"][:100])
        if kpi_bigrams:
            overlap = len(term_bigrams & kpi_bigrams)
            ratio = overlap / max(len(term_bigrams), 1)
            score += 5 * ratio

    # Token overlap → +2 per token
    text_tokens = set(search_text.split())
    score += 2 * len(term_tokens & text_tokens)

    return score


def search_kpis(term: str, top_n: int = 5) -> List[Dict[str, Any]]:
    """Search KPIs: alias → heuristic → FAISS vector search (if enabled).

    Priority:
      1. Alias exact match → instant return
      2. Heuristic score >= 10 → trust it (exact/substring match)
      3. FAISS vector search → semantic similarity
      4. Heuristic results as fallback
    """
    if not term or not KPI_SEARCH_TEXT:
        return []

    term_lower = term.lower().replace("_", " ").strip()

    # Alias check (instant)
    if term_lower in KPI_ALIASES:
        direct_id = KPI_ALIASES[term_lower]
        direct = KPI_LOOKUP[direct_id].copy()
        direct["relevance_score"] = 20
        term_tokens = set(term_lower.split())
        term_bigrams_set = _bigrams(term_lower)
        others = []
        for kpi_id in KPI_SEARCH_TEXT:
            if kpi_id == direct_id:
                continue
            s = _score_kpi(kpi_id, term_lower, term_tokens, term_bigrams_set)
            if s > 0:
                others.append((kpi_id, s))
        others.sort(key=lambda x: x[1], reverse=True)
        results = [direct]
        for kpi_id, s in others[:top_n - 1]:
            entry = KPI_LOOKUP[kpi_id].copy()
            entry["relevance_score"] = s
            results.append(entry)
        return results

    # Heuristic search (fast, no model call)
    term_tokens = set(term_lower.split())
    term_bigrams_set = _bigrams(term_lower)
    scored = []
    for kpi_id in KPI_SEARCH_TEXT:
        s = _score_kpi(kpi_id, term_lower, term_tokens, term_bigrams_set)
        if s > 0:
            scored.append((kpi_id, s))
    scored.sort(key=lambda x: x[1], reverse=True)

    heuristic_results = []
    for kpi_id, s in scored[:top_n]:
        entry = KPI_LOOKUP[kpi_id].copy()
        entry["relevance_score"] = s
        heuristic_results.append(entry)

    # Strong heuristic match → trust it
    if heuristic_results and heuristic_results[0].get("relevance_score", 0) >= 10:
        return heuristic_results

    # FAISS vector search (semantic)
    if USE_SEMANTIC_SEARCH and _FAISS_INDEX is not None:
        vector_results = _vector_search(term, top_n)
        if vector_results:
            return vector_results

    return heuristic_results


def build_registry_context() -> str:
    """Compact one-line-per-KPI representation for LLM prompts."""
    global _REGISTRY_CONTEXT_CACHE
    if _REGISTRY_CONTEXT_CACHE is not None:
        return _REGISTRY_CONTEXT_CACHE

    lines = []
    for kpi in KPI_DB:
        line = f"- {kpi['id']}: {kpi['name']} — {kpi['description']}"
        if kpi["formula"]:
            line += f" [Formula: {kpi['formula']}]"
        if kpi["category"]:
            line += f" [{kpi['category']}]"
        lines.append(line)

    _REGISTRY_CONTEXT_CACHE = "\n".join(lines)
    return _REGISTRY_CONTEXT_CACHE


def fuzzy_match(term: str) -> Dict[str, Any]:
    """Match a term to a KPI: exact → alias → search → LLM fallback.
    Returns {found, kpi_id, kpi_config, confidence, similar}."""

    # Step 1: Exact ID or name match
    q = term.lower().replace("_", " ").strip()
    for kpi in KPI_DB:
        if kpi["id"].replace("_", " ") == q:
            return {"found": True, "kpi_id": kpi["id"], "kpi_config": kpi, "confidence": 1.0, "similar": []}
        if kpi["name"].lower() == q:
            return {"found": True, "kpi_id": kpi["id"], "kpi_config": kpi, "confidence": 1.0, "similar": []}

    # Step 2: Alias match
    if q in KPI_ALIASES:
        kpi_id = KPI_ALIASES[q]
        return {"found": True, "kpi_id": kpi_id, "kpi_config": KPI_LOOKUP[kpi_id], "confidence": 0.95, "similar": []}

    # Step 3: Name token containment
    for kpi in KPI_DB:
        name_tokens = kpi["name"].lower().split()
        if len(name_tokens) >= 2 and all(t in q for t in name_tokens):
            return {"found": True, "kpi_id": kpi["id"], "kpi_config": kpi, "confidence": 0.9, "similar": []}

    # Step 4: Search (uses FAISS if available, else heuristic)
    search_results = search_kpis(term, top_n=5)
    if search_results and search_results[0].get("relevance_score", 0) >= 10:
        top = search_results[0]
        similar = search_results[1:4] if len(search_results) > 1 else []
        return {
            "found": True,
            "kpi_id": top["id"],
            "kpi_config": KPI_LOOKUP[top["id"]],
            "confidence": min(0.85, search_results[0]["relevance_score"] / 20),
            "similar": similar,
        }

    # Step 5: LLM fuzzy match (last resort)
    registry_lines = build_registry_context()
    prompt = f"""Match the user's metric term to the closest KPI in our registry.
If no KPI matches the concept, say "not_found".

USER'S TERM: "{term}"

REGISTRY:
{registry_lines}

Respond with JSON only:
{{
    "match": "exact" | "fuzzy" | "not_found",
    "kpi_id": "matched_id_or_empty",
    "confidence": 0.0-1.0,
    "similar_ids": ["id1", "id2", "id3"],
    "reasoning": "short reason"
}}"""

    try:
        response = fast_complete([{"role": "user", "content": prompt}], temperature=0.1)
        m = re.search(r"\{.*\}", response.strip(), re.DOTALL)
        if m:
            data = json.loads(m.group())
            kpi_id = data.get("kpi_id", "").strip()
            match_type = data.get("match", "not_found")
            similar_ids = data.get("similar_ids", [])
            similar = [KPI_LOOKUP[sid] for sid in similar_ids if sid in KPI_LOOKUP]

            if match_type in ("exact", "fuzzy") and kpi_id and kpi_id in KPI_LOOKUP:
                return {
                    "found": True,
                    "kpi_id": kpi_id,
                    "kpi_config": KPI_LOOKUP[kpi_id],
                    "confidence": float(data.get("confidence", 0.7)),
                    "similar": similar,
                }
            else:
                return {
                    "found": False,
                    "kpi_id": "",
                    "kpi_config": None,
                    "confidence": 0.0,
                    "similar": similar or search_results[:3],
                }
    except Exception as e:
        logger.debug(f"LLM fuzzy match failed: {e}")

    return {
        "found": False,
        "kpi_id": "",
        "kpi_config": None,
        "confidence": 0.0,
        "similar": search_results[:3] if search_results else [],
    }
