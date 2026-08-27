# Genera el .exe portable de "Separador Cruz Verde".
#
# Que hace:
#   1) Compila el frontend (vite build -> dist/) -- Vite empaqueta ahi TODO lo que la
#      ventana (React/exceljs/xlsx/jszip/supabase) necesita en tiempo de ejecucion.
#   2) Genera el manual de uso en PDF
#   3) Empaqueta la app de Electron con electron-packager (carpeta portable, sin instalador),
#      excluyendo node_modules del paquete: el proceso principal de Electron
#      (electron/main.cjs, preload.cjs, outlook.cjs) solo usa modulos nativos de Node
#      (path/fs/os/child_process) y 'electron' -- ninguna dependencia de npm hace falta en
#      tiempo de ejecucion, ya quedo compilada dentro de dist/. Sin excluirlo, el .asar
#      terminaba pesando 70-350MB con dependencias (de produccion Y de desarrollo) que
#      nunca se usan corriendo la app empaquetada.
#   4) Copia el PDF y ordena a una subcarpeta los archivos que NO son necesarios para
#      ejecutar la app (licencias, numero de version) -- el resto (dll/pak/locales/
#      resources) son del runtime de Electron/Chromium y deben quedar junto al .exe
#   5) Comprime la carpeta resultante en un .zip listo para enviar
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

Write-Host "== 1/5 Instalando dependencias (si hace falta) ==" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $root "node_modules"))) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install fallo" }
}

Write-Host "== 2/5 Compilando frontend (vite build) ==" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "vite build fallo" }

Write-Host "== 3/5 Generando manual en PDF ==" -ForegroundColor Cyan
$tmpPdf = Join-Path $root "MANUAL DE USO.pdf"
$manualMd = Join-Path $root "MANUAL-DE-USO.md"
$pdfOk = $false
if (Test-Path $manualMd) {
    if (Test-Path $tmpPdf) { Remove-Item $tmpPdf -Force }
    try {
        node scripts\build-manual-pdf.mjs $manualMd $tmpPdf
        if ($LASTEXITCODE -eq 0 -and (Test-Path $tmpPdf)) { $pdfOk = $true }
    } catch {
        Write-Host "  Aviso: no se pudo generar el PDF ($_). Se copia el .md en su lugar." -ForegroundColor Yellow
    }
}

Write-Host "== 4/5 Empaquetando con electron-packager ==" -ForegroundColor Cyan
if (Test-Path (Join-Path $root "$outDir\$appName-win32-x64")) {
    Remove-Item -Recurse -Force (Join-Path $root "$outDir\$appName-win32-x64")
}
# La descarga del zip de Electron (GitHub releases) es intermitente -- reintenta unas veces
# antes de rendirse.
$packagerOk = $false
for ($i = 1; $i -le 4; $i++) {
    npx electron-packager . "$appName" `
        --platform=win32 `
        --arch=x64 `
        --out=$outDir `
        --icon=assets\icon.ico `
        --app-version=$version `
        --overwrite `
        --asar `
        --ignore="^/(src|scripts|node_modules|release|app-build|supabase|\.git|\.env.*|README\.md|MANUAL-DE-USO\.md|build-exe\.ps1)$"
    if ($LASTEXITCODE -eq 0) { $packagerOk = $true; break }
    Write-Host "  electron-packager fallo (intento $i/4), reintentando en 10s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}
if (-not $packagerOk) { throw "electron-packager fallo tras varios intentos" }

$pkgFolder = Join-Path $root "$outDir\$appName-win32-x64"
$asarPath = Join-Path $pkgFolder "resources\app.asar"
$asarMb = [math]::Round((Get-Item $asarPath).Length / 1MB, 1)
Write-Host "  app.asar: $asarMb MB"
if ($asarMb -gt 5) {
    Write-Host "  Aviso: app.asar se ve mas grande de lo esperado (>5MB) -- revisa a mano si se colo algo." -ForegroundColor Yellow
}

if ($pdfOk) {
    Move-Item $tmpPdf (Join-Path $pkgFolder "MANUAL DE USO.pdf") -Force
} elseif (Test-Path $manualMd) {
    Copy-Item $manualMd (Join-Path $pkgFolder "MANUAL DE USO.md") -Force
}

Write-Host "== 5/5 Ordenando archivos internos y comprimiendo ==" -ForegroundColor Cyan

# FIX: el zip de Electron trae varios archivos (locales/*.pak, algunas dll) con fecha
# 31/12/1979 -- un artefacto de como se extrae ese zip -- que cae ANTES del minimo que el
# formato ZIP puede representar (1980-01-01). Compress-Archive revienta al toparse con uno
# ("El valor de DateTimeOffset especificado no se puede convertir en la marca de tiempo de un
# archivo Zip") en vez de ignorarlo. Se corrigen a "ahora" antes de comprimir.
$minZipDate = Get-Date "1980-01-02T00:00:00"
$maxZipDate = Get-Date "2107-12-30T23:59:59"
$nowStamp = Get-Date
$fixedDates = 0
Get-ChildItem -Path $pkgFolder -Recurse -File | ForEach-Object {
    if ($_.LastWriteTime -lt $minZipDate -or $_.LastWriteTime -gt $maxZipDate) {
        $_.LastWriteTime = $nowStamp
        $fixedDates++
    }
}
if ($fixedDates -gt 0) { Write-Host "  Fechas fuera de rango corregidas: $fixedDates" -ForegroundColor Yellow }

# Estos 3 son metadatos (licencias, version) que Electron/Chromium NO lee en tiempo de ejecucion,
# asi que es seguro sacarlos de la vista. Todo lo demas junto al .exe (carpetas locales/ y
# resources/, los .dll y .pak) SI son parte del runtime y deben quedar donde estan.
$internalDir = Join-Path $pkgFolder "Componentes internos (no borrar)"
New-Item -ItemType Directory -Force -Path $internalDir | Out-Null
foreach ($f in @("LICENSE", "LICENSES.chromium.html", "version")) {
    $src = Join-Path $pkgFolder $f
    if (Test-Path $src) { Move-Item $src (Join-Path $internalDir $f) -Force }
}
@"
Esta carpeta solo tiene licencias de terceros y el numero de version interno de Electron/Chromium.
No se usan para que la app funcione -- estan aqui solo para no estorbar en la carpeta principal.

Los DEMAS archivos que quedaron junto a "$appName.exe" (las carpetas locales/ y resources/,
y los .dll/.pak sueltos) SI son necesarios: son el motor de Chromium con el que corre la app
(lo mismo pasa con cualquier programa hecho en Electron, como VSCode, Discord o Slack).
No los borres ni los muevas, o la app deja de abrir.
"@ | Out-File -FilePath (Join-Path $internalDir "LEEME.txt") -Encoding utf8

$zipPath = Join-Path $root "$outDir\$appName-win32-x64.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $pkgFolder -DestinationPath $zipPath -CompressionLevel Optimal -WarningAction SilentlyContinue

Write-Host ""
Write-Host "Listo." -ForegroundColor Green
Write-Host "Carpeta:  $pkgFolder"
Write-Host "Ejecutable: $pkgFolder\$appName.exe"
Write-Host "Zip para distribuir: $zipPath"
