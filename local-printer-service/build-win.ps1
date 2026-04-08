param()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js est requis pour construire l'executable."
}

npm install
npm run build:win
