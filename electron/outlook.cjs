const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

function sanitize(name) {
  return String(name || 'archivo.xlsx').replace(/[\\/:*?"<>|]/g, '_')
}

// payload: { emails: [{ provider, to:[], cc:[], subject, body, attachmentName, attachmentB64 }] }
// onProgress: (msg) => void   con msg { type:'progress', current, total, provider }
// Devuelve: { ok, fail, results, fatal? }
function sendViaOutlook(payload, onProgress) {
  return new Promise((resolve) => {
    const emails = (payload && payload.emails) || []
    if (!emails.length) { resolve({ ok: 0, fail: 0, results: [] }); return }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'separador-envio-'))

    const manifest = emails.map((m, i) => {
      let attachment = ''
      if (m.attachmentB64) {
        attachment = path.join(dir, `adj_${i}_${sanitize(m.attachmentName)}`)
        fs.writeFileSync(attachment, Buffer.from(m.attachmentB64, 'base64'))
      }
      return {
        index: i,
        provider: m.provider || '',
        to: (m.to || []).join(';'),
        cc: (m.cc || []).join(';'),
        subject: m.subject || '',
        body: m.body || '',
        attachment,
      }
    })
    const manifestPath = path.join(dir, 'manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8')

    // El .ps1 vive dentro del app.asar; PowerShell no puede ejecutarlo desde ahí.
    // Lo copiamos a disco real (fs SÍ lee desde el asar) y lo corremos desde el temp.
    const ps1 = path.join(dir, 'send-outlook.ps1')
    try {
      fs.writeFileSync(ps1, fs.readFileSync(path.join(__dirname, 'send-outlook.ps1')))
    } catch (e) {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* noop */ }
      resolve({ ok: 0, fail: 0, results: [], fatal: 'No se encontró el script de envío: ' + e.message })
      return
    }

    const results = []
    let fatal = null
    let stderr = ''

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Manifest', manifestPath],
      { windowsHide: true }
    )

    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d.toString('utf8')
      let idx
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line) continue
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.type === 'progress') onProgress && onProgress(msg)
        else if (msg.type === 'result') results.push(msg)
        else if (msg.type === 'fatal') fatal = msg.message
      }
    })
    child.stderr.on('data', (d) => { stderr += d.toString('utf8') })
    child.on('error', (e) => { fatal = fatal || ('No se pudo iniciar PowerShell: ' + e.message) })
    child.on('close', (code) => {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* noop */ }
      if (!fatal && results.length === 0) {
        fatal = stderr.trim()
          ? 'Error de PowerShell: ' + stderr.trim().split('\n')[0]
          : `PowerShell terminó sin resultados (código ${code}).`
      }
      const ok = results.filter((r) => r.ok).length
      const fail = results.filter((r) => !r.ok).length
      resolve({ ok, fail, results, fatal })
    })
  })
}

module.exports = { sendViaOutlook }
