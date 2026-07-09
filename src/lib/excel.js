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

// Lee el archivo y devuelve columnas, filas y la lista de proveedores encontrados.
export async function parseFile(file, type) {
  const buf = await file.arrayBuffer()
  const workbook = XLSX.read(buf, { type: 'array' })
  const sheetName = pickSheetName(workbook, type)
  const sheet = workbook.Sheets[sheetName]

  // Encabezados (primera fila)
  const headerMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  const columns = (headerMatrix[0] || []).map((c) => (c == null ? '' : String(c)))

  // Filas como objetos, valores como se muestran
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

  const providerColumn = type.providerColumn
  const providerColExists = columns.includes(providerColumn)

  const providers = providerColExists
    ? [...new Set(rows.map((r) => (r[providerColumn] || '').toString().trim()).filter(Boolean))].sort()
    : []

  return { sheetName, columns, rows, providerColumn, providerColExists, providers }
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

async function buildProviderWorkbook(providerRows, columns) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Datos')

  ws.columns = columns.map((c) => ({ header: c, key: c }))

  providerRows.forEach((r) => {
    const obj = {}
    columns.forEach((c) => { obj[c] = r[c] ?? '' })
    ws.addRow(obj)
  })

  // Encabezado verde Cruz Verde + negrita + centrado
  const header = ws.getRow(1)
  header.height = 20
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A651' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { top: THIN, right: THIN, bottom: THIN, left: THIN }
  })

  // Bordes en el resto de celdas
  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: THIN, right: THIN, bottom: THIN, left: THIN }
    })
  }

  // Ancho automático por columna
  ws.columns.forEach((col, i) => {
    const name = columns[i] || ''
    let max = name.length
    providerRows.forEach((r) => {
      const v = (r[name] ?? '').toString()
      if (v.length > max) max = v.length
    })
    col.width = Math.min(Math.max(max + 2, 10), 60)
  })

  return wb
}

// Devuelve un Blob (ZIP) y un resumen. onlyProviders opcional: set/array de nombres a incluir.
export async function generateZip({ rows, columns, providerColumn, prefix = '', onlyProviders = null }) {
  const groups = groupByProvider(rows, providerColumn)
  const filter = onlyProviders ? new Set(onlyProviders) : null

  const zip = new JSZip()
  let count = 0

  for (const [provider, providerRows] of groups) {
    if (filter && !filter.has(provider)) continue
    const wb = await buildProviderWorkbook(providerRows, columns)
    const buffer = await wb.xlsx.writeBuffer()
    zip.file(`${prefix}${sanitize(provider)}.xlsx`, buffer)
    count++
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, count }
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
