# Genera el .exe portable de "Separador Cruz Verde".
#
# Que hace:
#   1) Compila el frontend (vite build -> dist/)
#   2) Empaqueta la app de Electron con electron-packager (carpeta portable, sin instalador)
#   3) Copia el manual de uso dentro de la carpeta empaquetada
#   4) Comprime la carpeta resultante en un .zip listo para enviar
#
# Uso:
#   .\build-exe.ps1
#
# Resultado:
#   release\Separador Cruz Verde-win32-x64\Separador Cruz Verde.exe
#   release\Separador Cruz Verde-win32-x64.zip

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

$appName = "Separador Cruz Verde"
$outDir  = "release"
$pkgJson = Get-Content (Join-Path $root "package.json") | ConvertFrom-Json
$version = $pkgJson.version

Write-Host "== 1/4 Instalando dependencias (si hace falta) ==" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $root "node_modules"))) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install fallo" }
}

Write-Host "== 2/4 Compilando frontend (vite build) ==" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "vite build fallo" }

Write-Host "== 3/4 Empaquetando con electron-packager ==" -ForegroundColor Cyan
if (Test-Path (Join-Path $root "$outDir\$appName-win32-x64")) {
    Remove-Item -Recurse -Force (Join-Path $root "$outDir\$appName-win32-x64")
}
npx electron-packager . "$appName" `
    --platform=win32 `
    --arch=x64 `
    --out=$outDir `
    --icon=assets\icon.ico `
    --app-version=$version `
    --overwrite `
    --asar `
    --ignore="^/(src|release|app-build|supabase|\.git|\.env.*|README\.md|MANUAL-DE-USO\.md|build-exe\.ps1)$"
if ($LASTEXITCODE -ne 0) { throw "electron-packager fallo" }

$pkgFolder = Join-Path $root "$outDir\$appName-win32-x64"

Write-Host "== 4/4 Copiando manual y comprimiendo ==" -ForegroundColor Cyan
$manual = Join-Path $root "MANUAL-DE-USO.md"
if (Test-Path $manual) {
    Copy-Item $manual (Join-Path $pkgFolder "MANUAL DE USO.md") -Force
}

$zipPath = Join-Path $root "$outDir\$appName-win32-x64.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $pkgFolder -DestinationPath $zipPath -CompressionLevel Optimal -WarningAction SilentlyContinue

Write-Host ""
Write-Host "Listo." -ForegroundColor Green
Write-Host "Carpeta:  $pkgFolder"
Write-Host "Ejecutable: $pkgFolder\$appName.exe"
Write-Host "Zip para distribuir: $zipPath"
