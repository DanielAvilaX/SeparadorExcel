import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

// -------- Lectura del archivo subido --------

// Elige la hoja correcta según el tipo (por nombre sugerido, con fallback a la primera).
function pickSheetName(workbook, type) {
  const names = workbook.SheetNames
  for (const hint of type.sheetHints || []) {
    const found = names.find((n) => n.trim().toLowerCase() === hint.trim().toLowerCase())
    if (found) return found
  }
  return names[0]
}

// Detecta la fila de encabezado: la primera fila que contenga la columna de proveedor.
// (PACOM/Rotación la tienen en la fila 1; Descuentos en la fila 2/3.) Fallback: fila 1.
function findHeaderRow(matrix, providerColumn) {
  if (providerColumn) {
    const target = providerColumn.trim().toUpperCase()
    const idx = matrix.findIndex((row) =>
      row.some((c) => String(c ?? '').trim().toUpperCase() === target)
    )
    if (idx >= 0) return idx
  }
  // Si no hay columna de proveedor definida, usa la primera fila con ≥2 celdas con texto.
  const idx = matrix.findIndex((row) => row.filter((c) => String(c ?? '').trim() !== '').length >= 2)
  return idx >= 0 ? idx : 0
}

// Parsea a partir de un ArrayBuffer/Uint8Array ya leído (permite mostrar progreso de lectura aparte).
export function parseBuffer(buf, type) {
  const data = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = pickSheetName(workbook, type)
  const sheet = workbook.Sheets[sheetName]

  // Matriz completa (valores como se muestran) para ubicar el encabezado en cualquier fila.
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: false })

  const providerColumn = type.providerColumn
  const headerIdx = findHeaderRow(matrix, providerColumn)

  const columns = (matrix[headerIdx] || [])
    .map((c) => (c == null ? '' : String(c).trim()))

  // Filas de datos: debajo del encabezado, ignorando filas totalmente vacías.
  const rows = matrix
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => {
      const obj = {}
      columns.forEach((col, i) => { if (col) obj[col] = r[i] == null ? '' : r[i] })
      return obj
    })

  const providerColExists = columns.includes(providerColumn)
  const providers = providerColExists
    ? [...new Set(rows.map((r) => (r[providerColumn] || '').toString().trim()).filter(Boolean))].sort()
    : []

  return { sheetName, columns, rows, providerColumn, providerColExists, providers }
}

// Lee el archivo y devuelve columnas, filas y la lista de proveedores encontrados.
export async function parseFile(file, type) {
  const buf = await file.arrayBuffer()
  return parseBuffer(buf, type)
}

// -------- Generación del ZIP (un Excel por proveedor) --------

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120) || 'SIN_NOMBRE'
}

function groupByProvider(rows, providerColumn) {
  const groups = new Map()
  for (const row of rows) {
    const key = (row[providerColumn] || '').toString().trim()
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return groups
}

const THIN = { style: 'thin', color: { argb: 'FFBFD8C8' } }
const THIN_BLACK = { style: 'thin', color: { argb: 'FF000000' } }
const BOX = { top: THIN_BLACK, right: THIN_BLACK, bottom: THIN_BLACK, left: THIN_BLACK }

// Colores del formato original (verde / naranja / azul de los encabezados)
const FILL = {
  green: 'FF00B050',
  orange: 'FFFFC000',
  blue: 'FFB4C7E7',
  note: 'FFE2EFDA',
}

// Hoja "CONFIRMACION DESCUENTO". La estructura varía por tipo:
//   PACOM      -> 2 filas de nota + encabezado + filas fijas (PACOM / DESCUENTO POS)
//   DESCUENTOS -> 1 fila en blanco + encabezado + filas vacías para llenar
function addConfirmacionSheet(wb, spec) {
  const ws = wb.addWorksheet(spec.sheet)
  const n = spec.headers.length

  // Notas superiores
  ;(spec.notes || []).forEach((text) => {
    const row = ws.addRow([text])
    for (let c = 1; c <= n; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL.note } }
    }
  })

  // Filas en blanco antes del encabezado
  for (let i = 0; i < (spec.blankBefore || 0); i++) ws.addRow([])

  // Encabezado con sus colores
  const hr = ws.addRow(spec.headers.map((h) => h.label))
  hr.height = 34
  spec.headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[h.fill] } }
    cell.font = { bold: true, color: { argb: h.fill === 'green' ? 'FFFFFFFF' : 'FF000000' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = BOX
  })

  // Filas con etiqueta fija (ej. PACOM / DESCUENTO POS), resto vacío para que el proveedor llene
  ;(spec.staticRows || []).forEach((vals) => {
    const row = ws.addRow(vals)
    row.getCell(1).font = { bold: true }
    for (let c = 1; c <= n; c++) row.getCell(c).border = BOX
  })

  // Filas vacías con borde
  for (let i = 0; i < (spec.emptyRows || 0); i++) {
    const row = ws.addRow([])
    for (let c = 1; c <= n; c++) row.getCell(c).border = BOX
  }

  spec.headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width || Math.min(Math.max(h.label.length + 4, 14), 40)
  })
  return ws
}

// Encabezado verde Cruz Verde + negrita + centrado
function styleHeaderRow(row) {
  row.height = 20
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A651' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { top: THIN, right: THIN, bottom: THIN, left: THIN }
  })
}

function bordersFrom(ws, startRow) {
  for (let r = startRow; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: THIN, right: THIN, bottom: THIN, left: THIN }
    })
  }
}

function autoWidth(ws, columns, dataRows) {
  columns.forEach((name, i) => {
    let max = (name || '').length
    dataRows.forEach((r) => {
      const v = (r[name] ?? '').toString()
      if (v.length > max) max = v.length
    })
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 2, 10), 60)
  })
}

function toNumber(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
}

function money(n) {
  return '$ ' + Math.round(n).toLocaleString('en-US')
}

// Salida estándar — PACOM / Rotación. Si el tipo define hoja de confirmación, va primero.
async function buildProviderWorkbook(providerRows, columns, type) {
  const wb = new ExcelJS.Workbook()
  if (type && type.confirmacion) addConfirmacionSheet(wb, type.confirmacion)
  const ws = wb.addWorksheet((type && type.dataSheet) || 'Datos')
  ws.columns = columns.map((c) => ({ header: c, key: c }))
  providerRows.forEach((r) => {
    const obj = {}
    columns.forEach((c) => { obj[c] = r[c] ?? '' })
    ws.addRow(obj)
  })
  styleHeaderRow(ws.getRow(1))
  bordersFrom(ws, 2)
  autoWidth(ws, columns, providerRows)
  return wb
}

// Salida Descuentos: 2 hojas (CONFIRMACION DESCUENTO + DEPURACION con total, encabezado y filas).
async function buildDescuentosWorkbook(providerRows, type) {
  const output = type.output
  const wb = new ExcelJS.Workbook()

  // Hoja 1: formulario de confirmación
  if (type.confirmacion) addConfirmacionSheet(wb, type.confirmacion)

  // Hoja 2: depuración (fila de total + encabezado + filas del proveedor)
  const d = wb.addWorksheet(output.depuracionSheet)
  const cols = output.depuracionColumns
  const totalIdx = cols.indexOf(output.totalColumn)

  const total = providerRows.reduce((s, r) => s + toNumber(r[output.totalColumn]), 0)
  const totalRow = new Array(cols.length).fill('')
  if (totalIdx >= 0) totalRow[totalIdx] = money(total)
  const tr = d.addRow(totalRow)
  if (totalIdx >= 0) {
    const cell = tr.getCell(totalIdx + 1)
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'right' }
  }

  d.addRow(cols) // encabezado en la fila 2
  providerRows.forEach((r) => d.addRow(cols.map((col) => r[col] ?? '')))

  styleHeaderRow(d.getRow(2))
  bordersFrom(d, 2)
  autoWidth(d, cols, providerRows)

  return wb
}

// Genera un archivo Excel por proveedor. Devuelve [{ provider, filename, buffer }].
export async function buildProviderFiles({ rows, columns, providerColumn, prefix = '', type = null, onlyProviders = null }) {
  const groups = groupByProvider(rows, providerColumn)
  const filter = onlyProviders ? new Set(onlyProviders) : null
  const out = []
  for (const [provider, providerRows] of groups) {
    if (filter && !filter.has(provider)) continue
    const wb = type?.output?.mode === 'descuentos'
      ? await buildDescuentosWorkbook(providerRows, type)
      : await buildProviderWorkbook(providerRows, columns, type)
    const buffer = await wb.xlsx.writeBuffer()
    out.push({ provider, filename: `${prefix}${sanitize(provider)}.xlsx`, buffer })
  }
  return out
}

// Devuelve un Blob (ZIP) y un resumen. `type` decide el formato de salida.
export async function generateZip({ rows, columns, providerColumn, prefix = '', onlyProviders = null, type = null }) {
  const files = await buildProviderFiles({ rows, columns, providerColumn, prefix, type, onlyProviders })
  const zip = new JSZip()
  files.forEach((f) => zip.file(f.filename, f.buffer))
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, count: files.length }
}

// ArrayBuffer -> base64 (para pasar adjuntos al proceso de Electron).
export function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
