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

// Reconoce si un string es "inequívocamente" un número (con o sin separadores), para no
// coercer por error columnas alfanuméricas (códigos de proveedor, SKUs, etc.).
function isNumericLike(s) {
  const t = s.trim()
  if (t === '') return false
  return (
    /^\(?-?\$?\s*\d{1,3}(\.\d{3})*(,\d+)?\)?$/.test(t) || // 1.234.567,89  o  1.030
    /^\(?-?\$?\s*\d{1,3}(,\d{3})*(\.\d+)?\)?$/.test(t) || // 1,234,567.89  o  1,030
    /^\(?-?\$?\s*\d+([.,]\d+)?\)?$/.test(t)               // 1030  /  1030.5  /  1030,5
  )
}

// Convierte un valor de celda a número real, de forma robusta ante el origen del dato:
// - Si ya es number (celda numérica real gracias a raw:true), se usa tal cual.
// - Si es texto, se interpreta con la convención colombiana/latina: "." = separador de miles,
//   "," = separador decimal. Un solo "." (sin coma) SIEMPRE se trata como miles, nunca como
//   decimal: éste es justo el caso que causaba el bug original ("1.030" leído por JS como el
//   float 1.03 -- que pierde el cero final por normalización de punto flotante -- y terminaba
//   escribiéndose como "103"). Reportes reguardados por herramientas como Nitro Pro suelen dejar
//   estas columnas como texto en vez de números reales, así que raw:true por sí solo no basta.
// Devuelve null si el valor no es interpretable como número (columna no numérica / celda vacía).
function parseLocaleNumber(v) {
  if (typeof v === 'number') return v
  if (v == null) return null
  let s = String(v).trim()
  if (!isNumericLike(s)) return null

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1).trim()
  }
  s = s.replace(/^\$\s*/, '')
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  }

  if (s.includes(',') && s.includes('.')) {
    // El separador más a la derecha es el decimal; el otro es de miles.
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    // Solo coma: decimal salvo que todos los grupos posteriores tengan 3 dígitos (miles).
    const parts = s.split(',')
    const looksThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3)
    s = looksThousands ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (s.includes('.')) {
    // Solo puntos: siempre miles en estos datos (nunca decimal). Ver nota arriba.
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}

// Detecta qué columnas son numéricas y, de paso, NORMALIZA sus valores a number real
// (mutando `rows`) cuando el texto es inequívocamente numérico. Así el resto del pipeline
// (autoWidth, numFmt, escritura del xlsx de salida) trabaja siempre con el tipo correcto, sin
// importar si la celda llegó como number real o como texto con formato de miles.
function detectNumericColumns(rows, columns) {
  const numeric = new Set()
  columns.forEach((col) => {
    if (!col) return
    let sawValue = false
    let allNumeric = true
    for (const row of rows) {
      const v = row[col]
      if (v === '' || v == null) continue
      sawValue = true
      if (typeof v === 'number') continue
      if (parseLocaleNumber(v) === null) {
        allNumeric = false
        break
      }
    }
    if (sawValue && allNumeric) {
      numeric.add(col)
      for (const row of rows) {
        if (row[col] === '' || row[col] == null) continue
        row[col] = parseLocaleNumber(row[col])
      }
    }
  })
  return numeric
}

// Parsea a partir de un ArrayBuffer/Uint8Array ya leído (permite mostrar progreso de lectura aparte).
export function parseBuffer(buf, type) {
  const data = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = pickSheetName(workbook, type)
  const sheet = workbook.Sheets[sheetName]

  // FIX: raw: true -> nos da el valor crudo de la celda (number, string, boolean, Date),
  // no el texto ya formateado por el motor SSF de SheetJS. Esto evita que el separador de
  // miles/decimales del locale de origen (o de quien reguardó el archivo, ej. Nitro Pro)
  // se filtre como texto y provoque truncamientos o lecturas erróneas (ej. 1.030 -> "103").
  //
  // Ojo: como ahora headerIdx se busca sobre valores crudos, findHeaderRow ya convierte con
  // String(c) internamente, así que sigue funcionando igual para ubicar el encabezado.
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: true })

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

  // FIX: se calcula qué columnas son numéricas para poder escribirlas como números reales
  // (con formato) en el archivo de salida, en vez de como texto.
  const numericColumns = detectNumericColumns(rows, columns)

  return { sheetName, columns, rows, providerColumn, providerColExists, providers, numericColumns }
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

// FIX: formato numérico por defecto para columnas detectadas como numéricas en la hoja de datos.
const DEFAULT_NUM_FMT = '#,##0'

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
    // FIX: fallback a FILL.blue si el fill configurado no existe en el mapa, para no romper
    // el estilo (fgColor undefined) si algún header llega sin 'fill' o con un valor inesperado.
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[h.fill] || FILL.blue } }
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

// FIX: el cálculo de ancho ahora usa un texto "de exhibición" para números (con separador de
// miles) en vez del valor crudo, así el ancho de columna sigue viéndose bien aunque el dato
// ya no sea string.
function displayLength(v) {
  if (typeof v === 'number') return v.toLocaleString('en-US').length
  return (v ?? '').toString().length
}

function autoWidth(ws, columns, dataRows) {
  columns.forEach((name, i) => {
    let max = (name || '').length
    dataRows.forEach((r) => {
      const len = displayLength(r[name])
      if (len > max) max = len
    })
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 2, 10), 60)
  })
}

// Usa el mismo parser locale-aware que detectNumericColumns, para no duplicar la lógica de
// interpretación de separadores de miles/decimales.
function toNumber(v) {
  const n = parseLocaleNumber(v)
  return n === null ? 0 : n
}

function money(n) {
  return '$ ' + Math.round(n).toLocaleString('en-US')
}

// FIX: escribe cada fila respetando el tipo de dato (number vs string/otro) y aplica numFmt
// a las columnas detectadas como numéricas, en vez de dejar todo como texto en formato General.
function writeDataRow(ws, row, columns) {
  const obj = {}
  columns.forEach((c) => { obj[c] = row[c] ?? '' })
  return ws.addRow(obj)
}

function applyNumericFormats(ws, columns, numericColumns) {
  if (!numericColumns) return
  columns.forEach((col, i) => {
    if (numericColumns.has(col)) {
      ws.getColumn(i + 1).numFmt = DEFAULT_NUM_FMT
    }
  })
}

// Salida estándar — PACOM / Rotación. Si el tipo define hoja de confirmación, va primero.
async function buildProviderWorkbook(providerRows, columns, type, numericColumns) {
  const wb = new ExcelJS.Workbook()
  if (type && type.confirmacion) addConfirmacionSheet(wb, type.confirmacion)
  const ws = wb.addWorksheet((type && type.dataSheet) || 'Datos')
  ws.columns = columns.map((c) => ({ header: c, key: c }))
  providerRows.forEach((r) => writeDataRow(ws, r, columns))
  styleHeaderRow(ws.getRow(1))
  bordersFrom(ws, 2)
  autoWidth(ws, columns, providerRows)
  // FIX: aplica formato numérico real a las columnas detectadas, después de autoWidth
  // (autoWidth ya usa displayLength, así que el orden no afecta el ancho calculado).
  applyNumericFormats(ws, columns, numericColumns)
  return wb
}

// Salida Descuentos: 2 hojas (CONFIRMACION DESCUENTO + DEPURACION con total, encabezado y filas).
async function buildDescuentosWorkbook(providerRows, type, numericColumns) {
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
  // FIX: en esta hoja los datos empiezan en la fila 3 (fila 1 = total, fila 2 = encabezado),
  // pero numFmt se aplica a nivel de columna completa, así que igual cubre las filas de datos.
  applyNumericFormats(d, cols, numericColumns)

  return wb
}

// Genera un archivo Excel por proveedor. Devuelve [{ provider, filename, buffer }].
export async function buildProviderFiles({ rows, columns, providerColumn, prefix = '', type = null, onlyProviders = null, numericColumns = null }) {
  // FIX: validación temprana — si la columna de proveedor configurada no existe en los
  // encabezados detectados, antes se generaba un ZIP vacío sin ningún aviso. Ahora se lanza
  // un error explícito para que el problema se note de inmediato.
  if (columns && providerColumn && !columns.includes(providerColumn)) {
    throw new Error(
      `La columna de proveedor "${providerColumn}" no se encontró en el encabezado detectado (${columns.join(', ')}). Revisa la configuración del tipo de archivo o el encabezado del Excel de origen.`
    )
  }

  const groups = groupByProvider(rows, providerColumn)
  const filter = onlyProviders ? new Set(onlyProviders) : null
  const out = []
  const usedNames = new Set() // FIX: para detectar colisiones de nombre tras sanitize()
  const skippedRows = rows.length - [...groups.values()].reduce((s, arr) => s + arr.length, 0)

  for (const [provider, providerRows] of groups) {
    if (filter && !filter.has(provider)) continue
    const wb = type?.output?.mode === 'descuentos'
      ? await buildDescuentosWorkbook(providerRows, type, numericColumns)
      : await buildProviderWorkbook(providerRows, columns, type, numericColumns)
    const buffer = await wb.xlsx.writeBuffer()

    let filename = `${prefix}${sanitize(provider)}.xlsx`
    // FIX: si dos proveedores distintos sanitizan al mismo nombre de archivo, se agrega un
    // sufijo incremental en vez de sobrescribir uno de los dos silenciosamente en el ZIP.
    if (usedNames.has(filename)) {
      let n = 2
      let candidate = filename
      while (usedNames.has(candidate)) {
        candidate = `${prefix}${sanitize(provider)}_${n}.xlsx`
        n++
      }
      filename = candidate
    }
    usedNames.add(filename)

    out.push({ provider, filename, buffer, rowCount: providerRows.length })
  }

  // FIX: se expone cuántas filas no tenían proveedor y por lo tanto no fueron incluidas
  // en ningún archivo, para que la UI pueda avisarle al usuario en vez de perderlas en silencio.
  out.skippedRows = skippedRows

  return out
}

// Devuelve un Blob (ZIP) y un resumen. `type` decide el formato de salida.
export async function generateZip({ rows, columns, providerColumn, prefix = '', onlyProviders = null, type = null, numericColumns = null }) {
  const files = await buildProviderFiles({ rows, columns, providerColumn, prefix, type, onlyProviders, numericColumns })
  const zip = new JSZip()
  files.forEach((f) => zip.file(f.filename, f.buffer))
  const blob = await zip.generateAsync({ type: 'blob' })
  // FIX: se propaga skippedRows en el resumen devuelto.
  return { blob, count: files.length, skippedRows: files.skippedRows || 0 }
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