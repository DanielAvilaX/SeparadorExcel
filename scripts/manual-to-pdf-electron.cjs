// Ventana Electron oculta que carga el HTML del manual y lo imprime a PDF.
// Se invoca desde build-manual-pdf.mjs vía `electron manual-to-pdf-electron.cjs`, con la
// entrada/salida pasadas por variables de entorno (evita líos con el parseo de argv de Electron).
const { app, BrowserWindow } = require('electron')
const fs = require('fs')

const inputPath = process.env.MANUAL_PDF_INPUT
const outputPath = process.env.MANUAL_PDF_OUTPUT

if (!inputPath || !outputPath) {
  console.error('Faltan MANUAL_PDF_INPUT / MANUAL_PDF_OUTPUT')
  process.exit(1)
}

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
    await win.loadFile(inputPath)
    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.5, right: 0.5 },
    })
    fs.writeFileSync(outputPath, data)
    app.exit(0)
  } catch (e) {
    console.error('Fallo generando el PDF:', e)
    app.exit(1)
  }
})
