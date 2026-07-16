const electron = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const LOG = path.join(os.tmpdir(), 'separador-carga.log')
const log = (m) => { try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`) } catch { /* noop */ } }
log(`boot: process.type=${process.type} typeofElectron=${typeof electron} keys=${typeof electron === 'object' ? Object.keys(electron).join(',') : String(electron)}`)

const { app, BrowserWindow, ipcMain, protocol } = electron
const { sendViaOutlook, cancelSend } = require('./outlook.cjs')

const DIST = path.join(__dirname, '..', 'dist')

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
}

// Esquema propio (origen seguro) para evitar problemas de módulos por file://
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1120, height: 820, minWidth: 820, minHeight: 600,
    title: 'Separador & Envío · Cruz Verde',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    backgroundColor: '#EDF2EF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenuBarVisibility(false)

  win.webContents.on('did-finish-load', () => log('did-finish-load OK'))
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log(`did-fail-load ${code} ${desc} ${url}`))
  win.webContents.on('render-process-gone', (_e, d) => log(`render-process-gone ${JSON.stringify(d)}`))
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 2) log(`console-error: ${message}`) })

  if (process.env.ELECTRON_DEV) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadURL('app://local/index.html')
  }
  return win
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let rel = decodeURIComponent(new URL(req.url).pathname)
    if (!rel || rel === '/') rel = '/index.html'
    const filePath = path.join(DIST, rel)
    try {
      const data = fs.readFileSync(filePath)
      const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      return new Response(data, { headers: { 'content-type': mime } })
    } catch (e) {
      log(`protocol miss: ${filePath} (${e.message})`)
      return new Response('Not found', { status: 404 })
    }
  })

  ipcMain.handle('outlook:send', async (event, payload) =>
    sendViaOutlook(payload, (progress) => event.sender.send('outlook:progress', progress))
  )
  ipcMain.handle('outlook:cancel', () => { cancelSend(); return true })

  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => app.quit())
