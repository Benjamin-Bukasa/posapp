$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundleDir = Join-Path $root "build\installer-bundle"
$appDir = Join-Path $bundleDir "app"
$installerDir = Join-Path $root "installer"
$distDir = Join-Path $root "dist"
$targetExe = Join-Path $distDir "posapp-local-printer-service-installer.exe"
$sedPath = Join-Path $bundleDir "posapp-local-printer-service.sed"
$nodePath = (Get-Command node).Source

Write-Host "Preparation du bundle d'installation..."

if (Test-Path $bundleDir) {
  Remove-Item -Recurse -Force $bundleDir
}

New-Item -ItemType Directory -Path $bundleDir | Out-Null
New-Item -ItemType Directory -Path $appDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDir "src") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appDir "scripts") | Out-Null
if (-not (Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

Copy-Item (Join-Path $root "src\server.js") (Join-Path $appDir "src\server.js")
Copy-Item (Join-Path $root "src\printerService.js") (Join-Path $appDir "src\printerService.js")
Copy-Item (Join-Path $root "scripts\list-printers.ps1") (Join-Path $appDir "scripts\list-printers.ps1")
Copy-Item (Join-Path $root "scripts\print-raw.ps1") (Join-Path $appDir "scripts\print-raw.ps1")
Copy-Item (Join-Path $root ".env.example") (Join-Path $appDir ".env.example")
Copy-Item (Join-Path $root "README.md") (Join-Path $appDir "README.md")
Copy-Item $nodePath (Join-Path $appDir "node.exe")
Copy-Item (Join-Path $installerDir "run-service.cmd") (Join-Path $appDir "run-service.cmd")
Copy-Item (Join-Path $installerDir "stop-service.cmd") (Join-Path $appDir "stop-service.cmd")
Copy-Item (Join-Path $installerDir "install.cmd") (Join-Path $bundleDir "install.cmd")

$sourceDirEscaped = ($bundleDir.TrimEnd('\\') + '\\').Replace('\\', '\\\\')
$targetExeEscaped = $targetExe.Replace('\\', '\\\\')

$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=POSapp Local Printer Service a ete installe et demarre.
TargetName=$targetExeEscaped
FriendlyName=POSapp Local Printer Service
AppLaunched=install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=install.cmd
SourceFiles=SourceFiles
[Strings]
FILE0=install.cmd
FILE1=app\\node.exe
FILE2=app\\.env.example
FILE3=app\\README.md
FILE4=app\\run-service.cmd
FILE5=app\\stop-service.cmd
FILE6=app\\src\\server.js
FILE7=app\\src\\printerService.js
FILE8=app\\scripts\\list-printers.ps1
FILE9=app\\scripts\\print-raw.ps1
[SourceFiles]
SourceFiles0=$sourceDirEscaped
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
%FILE4%=
%FILE5%=
%FILE6%=
%FILE7%=
%FILE8%=
%FILE9%=
"@

Set-Content -Path $sedPath -Value $sed -Encoding ASCII

Write-Host "Generation de l'installeur Windows..."
& "$env:WINDIR\System32\iexpress.exe" /N $sedPath | Out-Null

if (-not (Test-Path $targetExe)) {
  throw "Le fichier installeur n'a pas ete genere."
}

Write-Host ""
Write-Host "Installeur pret :" -ForegroundColor Green
Write-Host $targetExe
