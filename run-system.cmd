@echo off
setlocal

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if not exist "package.json" (
  echo Could not find package.json in %ROOT_DIR%
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: npm is not installed or not in PATH.
  echo Install Node.js ^(LTS^) and re-run this script.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo Created .env from .env.example. Please review secrets if needed.
  ) else (
    echo WARNING: .env and .env.example not found. Backend may fail strict env validation.
  )
)

if not exist "node_modules" (
  echo First-time setup detected. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Fix the errors above and retry.
    echo.
    pause
    exit /b 1
  )
)

echo Starting backend + frontend...
call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo System exited with code %EXIT_CODE%.
  echo Common cause: missing/invalid env values ^(MONGO_URI, JWT_SECRET, API key^).
  echo.
  pause
)

exit /b %EXIT_CODE%
