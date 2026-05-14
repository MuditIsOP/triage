$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

if (-not (Test-Path (Join-Path $rootDir "package.json"))) {
  Write-Error "Could not find package.json in $rootDir"
}

function Test-Command {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "npm")) {
  Write-Host ""
  Write-Host "ERROR: npm is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Install Node.js (LTS) and re-run this script." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "Press Enter to exit"
  exit 1
}

$envFile = Join-Path $rootDir ".env"
$envExampleFile = Join-Path $rootDir ".env.example"

if (-not (Test-Path $envFile)) {
  if (Test-Path $envExampleFile) {
    Copy-Item -Path $envExampleFile -Destination $envFile
    Write-Host "Created .env from .env.example. Please review secrets if needed." -ForegroundColor Yellow
  } else {
    Write-Host "WARNING: .env and .env.example not found. Backend may fail strict env validation." -ForegroundColor Yellow
  }
}

$nodeModules = Join-Path $rootDir "node_modules"
if (-not (Test-Path $nodeModules)) {
  Write-Host "First-time setup detected. Installing dependencies..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Dependency installation failed. Fix the errors above and retry." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
  }
}

Write-Host "Starting backend + frontend..." -ForegroundColor Green
npm run dev
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Host ""
  Write-Host "System exited with code $exitCode." -ForegroundColor Red
  Write-Host "Common cause: missing/invalid env values (MONGO_URI, JWT_SECRET, API key)." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "Press Enter to close"
}

exit $exitCode
