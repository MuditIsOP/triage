@echo off
setlocal

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if not exist "package.json" (
  echo Could not find package.json in %ROOT_DIR%
  exit /b 1
)

call npm run dev

