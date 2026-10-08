import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'

// Lectura del Excel de entrada CON su estilo completo (formato de número, fuente, relleno,
// bordes, alineación, anchos). ExcelJS lo conserva tal cual; SheetJS (la librería de antes) solo
// daba valores, y por eso la salida tenía que "adivinar" formatos (el bug de los porcentajes).
//
// ExcelJS no lee .xls (formato binario viejo): para esos se usa SheetJS y se arma un libro de
// ExcelJS equivalente con valores + formato de número (sin colores/fuentes, que SheetJS no da).
export async function loadWorkbook(buf, fileName = '') {
  const data = buf instanceof ArrayBuffer
    ? buf
    : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  if (!/\.xls$/i.test(fileName)) {
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(data)
      return wb
    } catch (e) {
      console.warn('ExcelJS no pudo leer el archivo, se intenta con SheetJS:', e.message)
    }
  }
  return fromSheetJS(data)
}

// SheetJS (cellDates) arma la fecha con los campos LOCALES del equipo; ExcelJS la escribe según
// el instante UTC. Sin reconstruirla en UTC, la fecha de salida queda corrida por el huso horario.
function normalizeSheetJSDate(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()))
}

function fromSheetJS(data) {
  const src = XLSX.read(data, { type: 'array', cellDates: true, cellNF: true })
  const wb = new ExcelJS.Workbook()
  for (const name of src.SheetNames) {
    const s = src.Sheets[name]
    const ws = wb.addWorksheet(name)
    // Se recorren solo las celdas que existen: algunos reportes declaran rangos de 1.048.576 filas.
    for (const addr of Object.keys(s)) {
      if (addr[0] === '!') continue
      const c = s[addr]
      if (c == null || c.v == null || c.v === '') continue
      const cell = ws.getCell(addr)
      cell.value = c.v instanceof Date ? normalizeSheetJSDate(c.v) : c.v
      if (c.z && c.z !== 'General') cell.numFmt = c.z
    }
    ;(s['!cols'] || []).forEach((col, i) => { if (col && col.wch) ws.getColumn(i + 1).width = col.wch })
  }
  return wb
}

// Excel guarda algunos caracteres de control escapados como "_xHHHH_" (ej. "_x000D_" = salto de
// línea); ExcelJS no los traduce en resultados de fórmula, y quedaban como texto basura.
const decodeEscapes = (s) => s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))

// Texto "visible" de una celda, para comparar (encabezados, filtros, agrupar por proveedor).
export function cellText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return decodeEscapes(value).trim()
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('').trim()
    if ('result' in value || 'formula' in value || 'sharedFormula' in value) return cellText(value.result)
    if ('text' in value) return cellText(value.text)
    if ('error' in value) return String(value.error)
    return ''
  }
  return String(value).trim()
}

// Valor a escribir en la salida. Las fórmulas se escriben con su RESULTADO: al separar, las filas
// cambian de lugar y una fórmula que apunte a otras celdas daría un valor equivocado.
export function outputValue(value) {
  if (value == null) return null
  if (typeof value === 'string') return decodeEscapes(value).trim()
  if (typeof value === 'object' && !(value instanceof Date)) {
    if ('formula' in value || 'sharedFormula' in value) return outputValue(value.result ?? null)
  }
  return value
}

export const sameName = (a, b) => cellText(a).toUpperCase() === cellText(b).toUpperCase()

// Encabezado = primera fila (de las primeras 30) que contenga la columna de separación; si no hay
// columna de separación, la primera con al menos 2 celdas de texto.
export function detectHeaderRow(ws, splitColumn) {
  let found = null
  let firstTextRow = null
  let scanned = 0
  ws.eachRow((row, rowNumber) => {
    if (found || scanned >= 30) return
    scanned++
    const texts = []
    row.eachCell((cell) => { const t = cellText(cell.value); if (t && typeof cell.value !== 'number') texts.push(t) })
    if (splitColumn && texts.some((t) => sameName(t, splitColumn))) found = rowNumber
    if (!firstTextRow && texts.length >= 2) firstTextRow = rowNumber
  })
  return found || firstTextRow || 1
}

// Tabla de una hoja: encabezado + filas de datos (las filas de ExcelJS, para copiar valor y estilo
// de cada celda). Columnas sin título se ignoran, igual que antes.
export function readTable(ws, { headerRow = null, splitColumn = null } = {}) {
  const headerRowNumber = headerRow || detectHeaderRow(ws, splitColumn)
  const header = ws.getRow(headerRowNumber)
  const columns = []
  const seen = new Set()
  header.eachCell((cell, col) => {
    const name = cellText(cell.value)
    if (!name) return
    // Encabezados repetidos: se diferencian para que ninguna columna se pierda en silencio.
    let unique = name
    for (let n = 2; seen.has(unique.toUpperCase()); n++) unique = `${name} (${n})`
    seen.add(unique.toUpperCase())
    columns.push({ name: unique, col })
  })
  const rows = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return
    if (columns.some((c) => cellText(row.findCell(c.col)?.value) !== '')) rows.push(row)
  })
  return { ws, headerRowNumber, columns, rows }
}

// Resumen de un libro para el diseñador de configuraciones: hojas, encabezado detectado,
// columnas con ejemplos y cantidad de valores distintos.
export function analyzeWorkbook(wb, { splitColumn = null, headerRows = {} } = {}) {
  return wb.worksheets
    .filter((ws) => ws.actualRowCount > 0)
    .map((ws) => {
      const t = readTable(ws, { headerRow: headerRows[ws.name] || null, splitColumn })
      const columns = t.columns.map((c) => {
        const distinct = new Set()
        const samples = []
        for (const row of t.rows) {
          const v = cellText(row.findCell(c.col)?.value)
          if (!v) continue
          if (distinct.size < 5000) distinct.add(v)
          if (samples.length < 3 && !samples.includes(v)) samples.push(v)
        }
        return { name: c.name, samples, distinct: distinct.size }
      })
      return { name: ws.name, headerRow: t.headerRowNumber, rowCount: t.rows.length, columns }
    })
}
