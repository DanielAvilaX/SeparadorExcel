param(
  [string]$Manifest,
  [int]$DelayMs = 2500,
  [int]$CooldownEvery = 0,
  [int]$CooldownMs = 0,
  [string]$CancelFile = ""
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Emit($obj) { Write-Output ($obj | ConvertTo-Json -Compress) }
function IsCancelled { return ($CancelFile -and (Test-Path -LiteralPath $CancelFile)) }

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

if ($items -isnot [System.Array]) { $items = @($items) }
$total = $items.Count
$i = 0

foreach ($it in $items) {
  if (IsCancelled) { Emit @{ type = 'cancelled'; sent = $i }; break }

  $i++
  Emit @{ type = 'progress'; index = $it.index; current = $i; total = $total; provider = $it.provider }
  try {
    $mail = $outlook.CreateItem(0)   # 0 = olMailItem
    $mail.To = [string]$it.to
    if ($it.cc) { $mail.CC = [string]$it.cc }
    $mail.Subject = [string]$it.subject

    if ($it.bodyHtml) { $mail.HTMLBody = [string]$it.bodyHtml }
    else { $mail.Body = [string]$it.body }

    # Imágenes del cuerpo: se adjuntan y se marcan con su Content-ID para que
    # se vean EN LÍNEA (no como archivos adjuntos sueltos).
    if ($it.images) {
      foreach ($img in $it.images) {
        if (-not (Test-Path -LiteralPath $img.path)) { continue }
        $att = $mail.Attachments.Add($img.path)
        try {
          $pa = $att.PropertyAccessor
          # PR_ATTACH_CONTENT_ID
          $pa.SetProperty("http://schemas.microsoft.com/mapi/proptag/0x3712001F", [string]$img.cid)
          # PR_ATTACHMENT_HIDDEN (para que no aparezca en la lista de adjuntos)
          $pa.SetProperty("http://schemas.microsoft.com/mapi/proptag/0x7FFE000B", $true)
        } catch { }
      }
    }

    # Adjunto principal (el Excel del proveedor)
    if ($it.attachment -and (Test-Path -LiteralPath $it.attachment)) {
      [void]$mail.Attachments.Add($it.attachment)
    }
    $mail.Send()
    Emit @{ type = 'result'; index = $it.index; provider = $it.provider; ok = $true }
  } catch {
    Emit @{ type = 'result'; index = $it.index; provider = $it.provider; ok = $false; message = $_.Exception.Message }
  }

  if ($i -lt $total) {
    if (IsCancelled) { Emit @{ type = 'cancelled'; sent = $i }; break }
    # Cada N correos, una pausa más larga (anti-spam / evitar bloqueos por ráfaga)
    if ($CooldownEvery -gt 0 -and ($i % $CooldownEvery) -eq 0 -and $CooldownMs -gt 0) {
      Emit @{ type = 'cooldown'; ms = $CooldownMs; current = $i; total = $total }
      $waited = 0
      while ($waited -lt $CooldownMs) {
        if (IsCancelled) { break }
        Start-Sleep -Milliseconds 500
        $waited += 500
      }
    } elseif ($DelayMs -gt 0) {
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

Emit @{ type = 'done'; total = $total }
