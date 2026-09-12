// Descarga e instala una actualización, sin instalador (la app sigue siendo portable).
//
// Cómo funciona, en corto:
//   1) Descarga el .zip del Release de GitHub a una carpeta temporal, reportando progreso.
//   2) Lo extrae con el `tar` que ya trae Windows 10/11 (bsdtar entiende .zip) -- no hace
//      falta ninguna dependencia nueva de npm para esto.
//   3) Arma un .bat temporal que espera a que ESTA app termine de cerrarse (recién ahí Windows
//      libera el .exe y las .dll que tenía abiertas) y encima copia los archivos nuevos sobre
//      la carpeta de instalación actual con robocopy.
//   4) Lo lanza desacoplado (detached) ANTES de cerrar la app, para que siga vivo cuando el
//      proceso principal ya no exista.
// El main.cjs es quien decide CUÁNDO cerrar la app (después de que el usuario confirma en la
// pantalla de Configuración) -- este módulo solo deja todo listo para que ese cierre dispare
// el reemplazo.
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const { Readable } = require('stream')
const { finished } = require('stream/promises')

const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')

async function downloadFile(url, destPath, onProgress) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar la actualización (HTTP ${res.status}).`)

  const total = Number(res.headers.get('content-length') || 0)
  const nodeStream = Readable.fromWeb(res.body)
  const out = fs.createWriteStream(destPath)

  // El progreso se reporta con un timer que lee out.bytesWritten, NO enganchado al evento
  // 'data' del stream de descarga. Probado que llamar a event.sender.send() (IPC hacia el
  // renderer) desde dentro del handler de 'data' -- compitiendo con el propio pipe() por
  // consumir el mismo stream -- corrompe bytes del archivo escrito (el tamaño final coincide
  // pero el contenido no, confirmado comparando SHA256). Desacoplar el aviso de progreso del
  // consumo del stream evita el problema por completo.
  let timer = null
  let lastReportedPercent = -1
  if (onProgress) {
    timer = setInterval(() => {
      const downloaded = out.bytesWritten
      const percent = total ? Math.round((downloaded / total) * 100) : null
      if (percent !== null && percent === lastReportedPercent) return
      lastReportedPercent = percent
      onProgress({ downloaded, total, percent })
    }, 200)
  }

  try {
    nodeStream.pipe(out)
    await finished(out)
  } finally {
    if (timer) clearInterval(timer)
  }
  if (onProgress) onProgress({ downloaded: out.bytesWritten, total, percent: total ? 100 : null })
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true })
    const p = spawn(TAR, ['-xf', zipPath, '-C', destDir], { windowsHide: true })
    let stderr = ''
    p.stderr.on('data', (d) => { stderr += d })
    p.on('error', reject)
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`No se pudo extraer la actualización (tar salió con código ${code}). ${stderr}`.trim()))
    })
  })
}

// El zip de build-exe.ps1 comprime la carpeta completa ("Separador Cruz Verde-win32-x64"), así
// que los archivos reales quedan un nivel más adentro de lo extraído. Se detecta en vez de
// asumir el nombre exacto, por si algún día cambia.
function findExtractedRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory())
  const files = entries.filter((e) => e.isFile())
  if (dirs.length === 1 && files.length === 0) return path.join(dir, dirs[0].name)
  return dir
}

// Descarga y deja lista (extraída y validada) la actualización, pero NO toca todavía la
// instalación actual -- eso lo hace el .bat que arma scheduleInstall, después de cerrar la app.
async function downloadAndPrepareUpdate(url, onProgress) {
  const workDir = path.join(os.tmpdir(), `separador-update-${Date.now()}`)
  fs.mkdirSync(workDir, { recursive: true })
  const zipPath = path.join(workDir, 'update.zip')
  const extractDir = path.join(workDir, 'extracted')

  try {
    await downloadFile(url, zipPath, onProgress)
    await extractZip(zipPath, extractDir)
    const sourceRoot = findExtractedRoot(extractDir)

    const hasExe = fs.readdirSync(sourceRoot).some((f) => f.toLowerCase().endsWith('.exe'))
    if (!hasExe) {
      throw new Error('El archivo descargado no parece ser una versión válida de la app (no se encontró el .exe).')
    }

    return { sourceRoot, workDir }
  } catch (e) {
    try { fs.rmSync(workDir, { recursive: true, force: true }) } catch { /* noop */ }
    throw e
  }
}

// Arma y lanza el .bat que espera a que este proceso (por pid) termine, reemplaza los archivos
// con robocopy, y se borra a sí mismo. Hay que llamarlo ANTES de app.quit().
function scheduleInstall({ sourceRoot, workDir, targetDir, pid }) {
  const batPath = path.join(os.tmpdir(), `separador-apply-update-${Date.now()}.bat`)
  const bat = [
    '@echo off',
    ':wait',
    `tasklist /FI "PID eq ${pid}" 2>NUL | find "${pid}" >NUL`,
    'if not errorlevel 1 (',
    '  timeout /t 1 /nobreak >NUL',
    '  goto wait',
    ')',
    // Un respiro extra: procesos auxiliares de Electron (GPU, etc.) pueden tardar un
    // instante mas en soltar sus archivos aunque el proceso principal ya no aparezca.
    'timeout /t 2 /nobreak >NUL',
    `robocopy "${sourceRoot}" "${targetDir}" /E /IS /IT /R:5 /W:1 >NUL`,
    `rmdir /S /Q "${workDir}"`,
    'del "%~f0"',
  ].join('\r\n')
  fs.writeFileSync(batPath, bat, 'utf8')

  const child = spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
}

module.exports = { downloadAndPrepareUpdate, scheduleInstall }
