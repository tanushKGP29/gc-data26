# Architecture

## Chat Pipeline

```
User Message
    |
    v
Intent Router (LLM classification)
    |
    v
LangGraph Orchestrator (state machine)
    |--- "explain"   --> Explanation Agent (5-phase CoT + KPI registry grounding)
    |--- "kpi"       --> KPI Agent (compute metric values from data)
    |--- "summary"   --> Summary Agent (dashboard overview)
    |--- "recommend"  --> Recommendation Agent (strategic advice)
    |--- "planner"   --> Planner (code-gen analysis pipeline)
    |        |
    |        v
    |    5 phases: Understand -> Plan -> Code -> Execute -> Assemble
    v
Response + Artifacts (charts, tables)
```

## Intent Router

LLM classifies user queries into 8 intents:
- `greeting` / `list_data` / `describe_data` --> routed to Planner
- `kpi_lookup` --> KPI Agent (wants a number: "what is the publish rate?")
- `summary` --> Summary Agent
- `recommend` --> Recommendation Agent
- `explain` --> Explanation Agent (wants understanding: "explain viral velocity score")
- `analyze` --> Planner (custom analysis, charts, comparisons)

Key distinction: "explain X" = explain route, "what is X?" (wanting a number) = kpi route.

## KPI Registry + Vector Search

`kpi_registry_tool.py` is the shared knowledge base used by all agents.

**At startup:**
1. Loads 47 KPIs from `analytics/kpi_registry.json`
2. Builds alias index (VVS, CYI, PES, GVI, etc.)
3. If `USE_SEMANTIC_SEARCH=true`:
   - Loads `all-MiniLM-L6-v2` sentence-transformer
   - Embeds each KPI (name + description + formula + interpretation)
   - Builds FAISS IndexFlatIP (cosine similarity)

**At query time (search_kpis):**
1. Alias check (instant) -- "vvs" -> viral_velocity_score
2. Heuristic scoring (instant) -- token overlap, substring, bigram similarity
3. If heuristic score < 10: FAISS vector search (semantic similarity, ~5ms)
4. If all fail: LLM fuzzy match (last resort, ~300ms)

**KPI categories:**
- `volume` -- total_uploaded, total_processed, total_published, etc.
- `conversion` -- publish_rate, process_rate, publish_dropoff, etc.
- `efficiency` -- amplification_ratio, avg_clips_per_upload, etc.
- `duration` -- uploaded_hours, processed_hours, avg_upload_min, etc.
- `advanced_framework` -- VVS, CYI, PES, GVI (simulator-only KPIs)

## Explanation Agent (5-phase CoT)

Handles "explain X" queries with KPI registry grounding.

```
Phase 1: UNDERSTAND
  - Classify: kpi_concept | result_clarification | general_concept | unclear
  - Extract term + clarity score

Phase 2: CLARITY CHECK
  - Only asks clarification if clarity_score < 0.4 AND type == "unclear"

Phase 3: RETRIEVE (kpi_concept only)
  - search_kpis() + fuzzy_match() against vector store
  - Builds grounding context from matched KPIs

Phase 4: EXPLAIN
  - LLM generates grounded explanation using retrieved KPI definitions
  - Different prompts for: found in registry vs not found vs result clarification

Phase 5: ASSEMBLE
  - Format response + suggest related KPIs
```

## Planner (Code-Gen Pipeline)

Handles complex analysis queries that need computation.

```
Phase 1: UNDERSTAND  -- classify query, identify datasets needed
Phase 2: PLAN       -- generate analysis plan
Phase 3: CODE       -- LLM writes Python/pandas code
Phase 4: EXECUTE    -- run code in sandbox, capture output + charts
Phase 5: ASSEMBLE   -- combine results into response with artifacts
```

## Frontend Dashboard

7 sections, each with sub-tabs:
- **Executive Command Center** -- KPI cards, monthly trends, alerts
- **Content Funnel** -- upload/create/publish pipeline, by-type breakdown
- **Trends & Usage** -- time series, duration analysis, heatmaps
- **Deep Explorer** -- user rankings, channel drilldown, data quality, KPI Framework
- **Multi-Dimensional** -- channel/user/platform intelligence
- **Client View** -- client-facing summary

**KPI Framework** (Explorer > advanced_kpi tab):
- Viral Velocity Score (VVS) -- power-law viral prediction simulator
- Content Yield Index (CYI) -- content pipeline efficiency simulator
- Platform Efficiency Score (PES) -- cost-per-watch-hour benchmarking
- Geo Value Index (GVI) -- geographic reach-to-cost scoring

## Conversation Memory

Server-side session memory keyed by `session_id`:
- Stores last 10 turns per session
- Summarizes older turns automatically
- Frontend also sends `conversation_context` as fallback (last 10 messages)
- Backend prefers server-side memory, falls back to frontend context

## LLM Models

All LLM calls go through `llm/groq_client.py`:
- `fast_complete()` -- llama-3.1-8b-instant (~0.3s) for routing, classification, code-gen
- `think_complete()` -- llama-3.3-70b-versatile (~1s) for reasoning, explanations, planning
