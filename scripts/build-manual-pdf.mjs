// Convierte MANUAL-DE-USO.md a un PDF con estilos básicos, usando el propio Electron del
// proyecto (BrowserWindow oculta + webContents.printToPDF) en vez de automatizar un navegador
// externo -- Edge/Chrome headless resultó ser poco confiable para esto (ver manual-to-pdf-electron.cjs).
// Se usa desde build-exe.ps1 antes de empaquetar el ZIP.
//
// Uso: node scripts/build-manual-pdf.mjs <entrada.md> <salida.pdf>

import { marked } from 'marked'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import electronPath from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const [, , inputPath, outputPath] = process.argv
if (!inputPath || !outputPath) {
  console.error('Uso: node build-manual-pdf.mjs <entrada.md> <salida.pdf>')
  process.exit(1)
}

const md = fs.readFileSync(inputPath, 'utf8')
const bodyHtml = marked.parse(md)

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Manual de uso</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; }
  h1 { color: #00A651; border-bottom: 3px solid #00A651; padding-bottom: 6px; font-size: 20pt; }
  h2 { color: #00A651; margin-top: 28px; font-size: 15pt; border-bottom: 1px solid #cfe8db; padding-bottom: 4px; }
  h3 { color: #146c37; margin-top: 20px; font-size: 12.5pt; }
  h4 { font-size: 11.5pt; margin-top: 16px; }
  a { color: #146c37; }
  code { background: #f0f4f1; padding: 1px 5px; border-radius: 3px; font-size: 0.92em; }
  blockquote { border-left: 4px solid #00A651; margin: 10px 0; padding: 4px 14px; background: #f3faf5; color: #333; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
  th, td { border: 1px solid #cfd8d2; padding: 6px 10px; text-align: left; }
  th { background: #00A651; color: #fff; }
  tr:nth-child(even) td { background: #f7faf8; }
  hr { border: none; border-top: 1px solid #d8e3dc; margin: 22px 0; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`

const tmpHtml = path.join(os.tmpdir(), `manual-uso-${Date.now()}.html`)
fs.writeFileSync(tmpHtml, html, 'utf8')

const absOut = path.resolve(outputPath)
if (fs.existsSync(absOut)) fs.unlinkSync(absOut)

const rendererScript = path.join(__dirname, 'manual-to-pdf-electron.cjs')

// ELECTRON_RUN_AS_NODE (si viene del entorno donde corre este script) hace que electron.exe se
// ejecute como Node plano en vez de como app de Electron -- 'electron' (app/BrowserWindow) queda
// undefined en ese modo. Hay que asegurarse de que NO esté seteada para este subproceso.
const childEnv = { ...process.env, MANUAL_PDF_INPUT: tmpHtml, MANUAL_PDF_OUTPUT: absOut }
delete childEnv.ELECTRON_RUN_AS_NODE

try {
  execFileSync(electronPath, [rendererScript], {
    stdio: 'inherit',
    timeout: 30000,
    env: childEnv,
  })
} finally {
  fs.unlinkSync(tmpHtml)
}

if (!fs.existsSync(absOut)) {
  console.error('Electron no generó el PDF.')
  process.exit(3)
}

console.log('PDF generado:', absOut)
