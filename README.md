# Frammer Agent

AI-powered analytics assistant for Frammer AI's media publishing platform.

## Quick Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```
GROQ_API_KEY=your_groq_api_key
USE_SEMANTIC_SEARCH=true
```

Start the server:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend-main
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`, proxies API calls to the backend.

### Data

Place your CSV datasets in `backend/data/`. The system auto-discovers them on startup.

## Tech Stack

- **Frontend**: Next.js 16 + Chart.js
- **Backend**: FastAPI + LangGraph orchestrator
- **LLM**: Groq (llama-3.1-8b for fast tasks, llama-3.3-70b for reasoning)
- **Vector Search**: FAISS + sentence-transformers (all-MiniLM-L6-v2)
- **KPI Registry**: 47 KPIs defined in `backend/analytics/kpi_registry.json`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | required | Groq API key |
| `USE_SEMANTIC_SEARCH` | `true` | Enable FAISS vector search for KPI matching |
| `GROQ_FAST_MODEL` | `llama-3.1-8b-instant` | Fast model for routing/classification |
| `GROQ_THINK_MODEL` | `llama-3.3-70b-versatile` | Think model for reasoning/analysis |

## Project Structure

```
backend/
  main.py                  # FastAPI app + endpoints
  intent_router.py         # LLM-based intent classification
  planner.py               # 5-phase analysis pipeline
  explanation_agent.py     # Multi-phase CoT explanation with KPI grounding
  kpi_agent.py             # KPI value computation
  kpi_registry_tool.py     # Shared KPI knowledge base + FAISS vector store
  recommendation_agent.py  # Strategic recommendations
  analytics_summary_agent.py
  conversation_memory.py   # Session-based chat memory
  orchestrator/
    langgraph_orchestrator.py  # LangGraph state machine router
  analytics/
    kpi_registry.json      # 47 KPI definitions
    kpi_executor.py        # KPI computation engine
    kpi_functions.py       # Individual KPI compute functions
    frontend_adapter.py    # Transforms analytics → frontend views
  llm/
    groq_client.py         # Groq LLM client (fast + think models)

frontend-main/
  app/                     # Next.js app router
  components/
    sections/              # Dashboard section components
    ui/RightPanel.tsx       # Chat panel with chart/table rendering
  hooks/                   # Data fetching hooks
  public/data/             # Static dashboard data
```
