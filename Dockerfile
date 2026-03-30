FROM python:3.11-slim

WORKDIR /app/frammer_agent

# System deps for pandas/numpy compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only first (avoids pulling CUDA ~2GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy and install Python deps (layer cached)
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Copy project files
COPY __init__.py .
COPY config.py .
COPY backend/ ./backend/
COPY llm/ ./llm/
COPY tools/ ./tools/

# Create data directories (will be mounted as volumes)
RUN mkdir -p data/datasets data/merged data/saved_analytics \
    data/chart_data data/chroma data/models logs

# The parent package "frammer_agent" must be importable
# PYTHONPATH=/app makes "from frammer_agent.config import ..." work
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
