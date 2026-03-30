@echo off
echo Starting Frammer AI Agent (Simplified)
echo.

REM Check if conda environment exists
call conda env list | findstr "frammer_agent" >nul
if errorlevel 1 (
    echo Creating conda environment...
    call conda create -n frammer_agent python=3.11 -y
)

echo Activating environment...
call conda activate frammer_agent

echo Installing dependencies...
cd backend
pip install -r requirements.txt -q

echo.
echo ========================================
echo Starting Backend Server
echo ========================================
echo.

python main_simple.py
