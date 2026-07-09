param([string]$Manifest)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Emit($obj) { Write-Output ($obj | ConvertTo-Json -Compress) }

# Leer el manifiesto (UTF-8) generado por la app
try {
  $json  = Get-Content -Raw -LiteralPath $Manifest -Encoding UTF8
  $items = $json | ConvertFrom-Json
} catch {
  Emit @{ type = 'fatal'; message = "No se pudo leer el manifiesto: $($_.Exception.Message)" }
  exit 1
}

# Abrir (o enganchar) Outlook de escritorio
try {
  $outlook = New-Object -ComObject Outlook.Application
} catch {
  Emit @{ type = 'fatal'; message = "No se pudo abrir Outlook de escritorio: $($_.Exception.Message)" }
  exit 1
}

# Un solo item no llega como arreglo: normalizar
if ($items -isnot [System.Array]) { $items = @($items) }
$total = $items.Count
$i = 0

foreach ($it in $items) {
  $i++
  Emit @{ type = 'progress'; index = $it.index; current = $i; total = $total; provider = $it.provider }
  try {
    $mail = $outlook.CreateItem(0)   # 0 = olMailItem
    $mail.To = [string]$it.to
    if ($it.cc) { $mail.CC = [string]$it.cc }
    $mail.Subject = [string]$it.subject
    $mail.Body = [string]$it.body
    if ($it.attachment -and (Test-Path -LiteralPath $it.attachment)) {
      [void]$mail.Attachments.Add($it.attachment)
    }
    $mail.Send()
    Emit @{ type = 'result'; index = $it.index; provider = $it.provider; ok = $true }
  } catch {
    Emit @{ type = 'result'; index = $it.index; provider = $it.provider; ok = $false; message = $_.Exception.Message }
  }
}

Emit @{ type = 'done'; total = $total }
