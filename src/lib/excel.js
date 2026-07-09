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

// Salida estándar (1 hoja con las columnas seleccionadas) — PACOM / Rotación.
async function buildProviderWorkbook(providerRows, columns) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Datos')
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

// Salida Descuentos: 2 hojas (CONFIRMACION DESCUENTO en blanco + DEPURACION con total, encabezado y filas).
async function buildDescuentosWorkbook(providerRows, output) {
  const wb = new ExcelJS.Workbook()

  // Hoja 1: formulario de confirmación (solo encabezados)
  const c = wb.addWorksheet(output.confirmacionSheet)
  c.addRow(output.confirmacionColumns)
  styleHeaderRow(c.getRow(1))
  output.confirmacionColumns.forEach((name, i) => {
    c.getColumn(i + 1).width = Math.max((name || '').length + 2, 16)
  })

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

// Devuelve un Blob (ZIP) y un resumen. `type` decide el formato de salida.
export async function generateZip({ rows, columns, providerColumn, prefix = '', onlyProviders = null, type = null }) {
  const groups = groupByProvider(rows, providerColumn)
  const filter = onlyProviders ? new Set(onlyProviders) : null

  const zip = new JSZip()
  let count = 0

  for (const [provider, providerRows] of groups) {
    if (filter && !filter.has(provider)) continue
    const wb = type?.output?.mode === 'descuentos'
      ? await buildDescuentosWorkbook(providerRows, type.output)
      : await buildProviderWorkbook(providerRows, columns)
    const buffer = await wb.xlsx.writeBuffer()
    zip.file(`${prefix}${sanitize(provider)}.xlsx`, buffer)
    count++
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, count }
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
