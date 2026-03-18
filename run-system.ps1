$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

if (-not (Test-Path (Join-Path $rootDir "package.json"))) {
  Write-Error "Could not find package.json in $rootDir"
}

npm run dev
