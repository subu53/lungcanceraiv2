@echo off
echo =======================================================
echo Lung Cancer AI Classification System (Standalone)
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Backend Environment...
if not exist "venv\Scripts\activate.bat" (
    echo Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Python not found or venv creation failed. Please install Python.
        pause
        exit /b 1
    )
    echo Installing backend dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    echo Backend environment found.
)

echo.
echo [2/3] Checking Frontend Environment...
cd frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    call npm install lucide-react axios
) else (
    echo Frontend environment found.
)
cd ..

echo.
echo [3/3] Starting Services...
echo.

:: Start Backend API in a new window
start cmd /k "title LungAI-Backend && echo Starting Backend... && call venv\Scripts\activate.bat && python -m uvicorn backend.main:app --reload --port 8000"

:: Start Frontend in a new window
start cmd /k "title LungAI-Frontend && echo Starting Frontend... && cd frontend && npm run dev"

echo.
echo =======================================================
echo Services are starting in new windows...
echo Frontend Dashboard: http://localhost:3000
echo Backend API Docs:   http://localhost:8000/docs
echo =======================================================
echo You can close this window.
pause
