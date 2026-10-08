// Descarga e instala una actualización, sin instalador (la app sigue siendo portable).
//
// Cómo funciona, en corto:
//   1) Descarga el .zip del Release de GitHub a una carpeta temporal, reportando progreso.
//   2) Lo extrae con el `tar` que ya trae Windows 10/11 (bsdtar entiende .zip) -- no hace
//      falta ninguna dependencia nueva de npm para esto.
//   3) Lanza un "ayudante" que espera a que ESTA app termine de cerrarse (recién ahí Windows
//      libera el .exe y las .dll que tenía abiertas), copia los archivos nuevos sobre la carpeta
//      de instalación y vuelve a abrir la app ya actualizada.
//   4) El ayudante es el .exe de la versión NUEVA (el que se acaba de extraer) corriendo en modo
//      Node (ELECTRON_RUN_AS_NODE): no abre ninguna ventana ni consola, y como corre desde la
//      carpeta temporal, no bloquea los archivos que tiene que reemplazar.
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

// Script del ayudante (corre con el Node que trae el .exe de la versión nueva).
// Antes era un .bat con tasklist | find + robocopy: lanzado desde la app sin consola propia, cada
// comando abría su propia ventana negra y el "find" se quedaba esperando para siempre, así que
// nunca llegaba a copiar nada (visto en un equipo real).
const HELPER_SCRIPT = `
// Electron trata los .asar como carpetas; sin esto, copiar resources/app.asar falla (ENOTDIR).
process.noAsar = true
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const [pid, sourceRoot, targetDir, exeName, logPath] = process.argv.slice(2)
const log = (m) => { try { fs.appendFileSync(logPath, new Date().toISOString() + ' ' + m + '\\n') } catch {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = (p) => { try { process.kill(p, 0); return true } catch (e) { return e.code === 'EPERM' } }
;(async () => {
  log('ayudante iniciado; esperando que cierre el proceso ' + pid)
  const t0 = Date.now()
  while (alive(Number(pid))) {
    if (Date.now() - t0 > 10 * 60 * 1000) { log('la app no cerró en 10 minutos; se cancela'); return }
    await sleep(500)
  }
  // Los procesos auxiliares de Electron (GPU, ventanas) pueden soltar sus archivos un poco después.
  await sleep(1500)
  let ok = false
  for (let i = 1; i <= 30 && !ok; i++) {
    try {
      fs.cpSync(sourceRoot, targetDir, { recursive: true, force: true })
      ok = true
      log('archivos copiados (intento ' + i + ')')
    } catch (e) {
      log('intento ' + i + ' falló: ' + e.message)
      await sleep(1000)
    }
  }
  const exe = path.join(targetDir, exeName)
  // La variable tiene que NO existir (vacía no basta): si existe, la app arrancaría en modo Node, sin ventana.
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ASAR
  try {
    spawn(exe, [], { cwd: targetDir, detached: true, stdio: 'ignore', env }).unref()
    log((ok ? 'app reabierta: ' : 'NO se pudo actualizar; se reabre la versión anterior: ') + exe)
  } catch (e) {
    log('no se pudo reabrir la app: ' + e.message)
  }
})()
`

// Lanza el ayudante que termina la instalación cuando la app cierre. Hay que llamarlo ANTES de
// app.quit(); el ayudante espera a que este proceso (pid) termine.
function scheduleInstall({ sourceRoot, targetDir, pid }) {
  const stamp = Date.now()
  const scriptPath = path.join(os.tmpdir(), `separador-apply-update-${stamp}.cjs`)
  const logPath = path.join(os.tmpdir(), 'separador-actualizacion.log')
  fs.writeFileSync(scriptPath, HELPER_SCRIPT, 'utf8')

  const exeName = fs.readdirSync(sourceRoot).find((f) => f.toLowerCase().endsWith('.exe'))
  const currentExeName = path.basename(process.execPath)
  const helperExe = path.join(sourceRoot, exeName)
  const child = spawn(helperExe, [scriptPath, String(pid), sourceRoot, targetDir, currentExeName, logPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ELECTRON_NO_ASAR: '1' },
  })
  child.unref()
}

// Al arrancar: borra lo que dejaron actualizaciones anteriores en la carpeta temporal (scripts
// del ayudante y carpetas de descarga). Si algo sigue en uso (ej. el ayudante terminando de
// cerrarse), el borrado falla en silencio y se reintenta la próxima vez.
function cleanupOldUpdateArtifacts() {
  let entries
  try { entries = fs.readdirSync(os.tmpdir()) } catch { return }
  for (const name of entries) {
    if (!/^separador-apply-update-\d+\.(bat|cjs)$/.test(name) && !/^separador-update-\d+$/.test(name)) continue
    try { fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true }) } catch { /* sigue en uso */ }
  }
}

module.exports = { downloadAndPrepareUpdate, scheduleInstall, cleanupOldUpdateArtifacts }
