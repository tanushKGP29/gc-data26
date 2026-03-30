#!/bin/bash
# Test script to run both frontend and backend with error logging

echo "======================================"
echo "STARTING SERVICES - Error Diagnostic"
echo "======================================"

# Kill any existing processes
echo "[1] Killing existing processes..."
killall node npm python uvicorn 2>/dev/null
sleep 2

# Start backend
echo ""
echo "[2] Starting Backend (FastAPI on port 8000)..."
cd /Users/harshnahata/Desktop/gc26-master
source venv/bin/activate
python -m uvicorn backend.main_simple:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "    Backend PID: $BACKEND_PID"
sleep 3
if ps -p $BACKEND_PID > /dev/null; then
    echo "    ✅ Backend started successfully"
else
    echo "    ❌ Backend failed to start"
    cat backend.log
    exit 1
fi

# Start frontend
echo ""
echo "[3] Starting Frontend (Next.js on port 3000/3001)..."
cd /Users/harshnahata/Desktop/gc26-master/frontend
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "    Frontend PID: $FRONTEND_PID"
sleep 5

if ps -p $FRONTEND_PID > /dev/null; then
    echo "    ✅ Frontend started successfully"
else
    echo "    ❌ Frontend failed to start"
    echo ""
    echo "--- Frontend Error Log ---"
    cat frontend.log
    exit 1
fi

# Test endpoints
echo ""
echo "[4] Testing endpoints..."
echo "    Testing Backend..."
curl -s http://localhost:8000/health || echo "    ❌ Backend not responding"

echo "    Testing Frontend (port 3000)..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 && echo "    ✅ Frontend responding on 3000" || echo "    Testing port 3001..."

echo "    Testing Frontend (port 3001)..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 && echo "    ✅ Frontend responding on 3001" || echo "    ❓ Not responding"

echo ""
echo "======================================"
echo "✅ Services started successfully!"
echo "======================================"
echo ""
echo "Access:"
echo "  • Frontend: http://localhost:3000 (or 3001)"
echo "  • Backend: http://localhost:8000"
echo "  • Logs: ./backend.log, ./frontend/frontend.log"
echo ""

wait
