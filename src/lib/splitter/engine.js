import ExcelJS from 'exceljs'
import { cellText, outputValue, readTable, sameName } from './workbook.js'
import { parseLocaleNumber } from '../numbers.js'

// ---------------------------------------------------------------------------------------------
// Definición de una configuración (lo que se guarda y se versiona):
// {
//   email: bool,                      // ¿se usa para enviar correos? (requiere separar por columna)
//   split: { by: 'column'|'rows'|'none', column: 'PROVEEDOR', size: 1000 },
//   output: 'files'|'sheets'|'single', // un archivo por grupo | un archivo con una hoja por grupo | un solo archivo
//   filters: [{ action: 'include'|'exclude', column, op, value }],
//   sheets: [
//     { type: 'data', name, source: ['NOMBRE HOJA', ...], fallback: 'first'|'none', optional,
//       headerRow: null|n, columns: null|[{ from, as }], total: null|'COLUMNA' },
//     { type: 'form', name, notes: [], blankBefore, headers: [{ label, fill: 'FF00B050', width }],
//       staticRows: [[...]], emptyRows },
//   ],
// }
// `columns: null` = todas las columnas que traiga el archivo, en su orden (si el reporte agrega o
// renombra una columna, la salida la refleja sola en vez de dejarla en blanco sin avisar).
// ---------------------------------------------------------------------------------------------

export const FILTER_OPS = [
  { key: 'eq', label: 'es igual a', needsValue: true },
  { key: 'neq', label: 'es distinto de', needsValue: true },
  { key: 'contains', label: 'contiene', needsValue: true },
  { key: 'not_contains', label: 'no contiene', needsValue: true },
  { key: 'one_of', label: 'es uno de (separados por ;)', needsValue: true },
  { key: 'empty', label: 'está vacío', needsValue: false },
  { key: 'not_empty', label: 'no está vacío', needsValue: false },
  { key: 'gt', label: 'es mayor que', needsValue: true },
  { key: 'lt', label: 'es menor que', needsValue: true },
]

const norm = (s) => cellText(s).toUpperCase()

function numberOf(value) {
  const v = outputValue(value)
  if (typeof v === 'number') return v
  return parseLocaleNumber(cellText(v))
}

function matches(filter, value) {
  const text = norm(value)
  const target = norm(filter.value)
  switch (filter.op) {
    case 'eq': return text === target
    case 'neq': return text !== target
    case 'contains': return text.includes(target)
    case 'not_contains': return !text.includes(target)
    case 'one_of': return String(filter.value || '').split(';').map(norm).filter(Boolean).includes(text)
    case 'empty': return text === ''
    case 'not_empty': return text !== ''
    case 'gt': case 'lt': {
      const a = numberOf(value)
      const b = parseLocaleNumber(String(filter.value ?? ''))
      if (a == null || b == null) return false
      return filter.op === 'gt' ? a > b : a < b
    }
    default: return true
  }
}

const findColumn = (table, name) => (name ? table.columns.find((c) => sameName(c.name, name)) : null)

function findSheetByHints(wb, hints) {
  for (const hint of hints || []) {
    const ws = wb.worksheets.find((w) => sameName(w.name, hint))
    if (ws) return ws
  }
  return null
}

export function validateDefinition(def) {
  const errors = []
  if (!def.sheets || !def.sheets.length) errors.push('Agrega al menos una hoja de salida.')
  if (!def.sheets.some((s) => s.type === 'data')) errors.push('Agrega al menos una hoja con datos del archivo.')
  if (def.split?.by === 'column' && !def.split.column) errors.push('Elige la columna por la que se separa.')
  if (def.split?.by === 'rows' && !(def.split.size > 0)) errors.push('Indica cuántas filas lleva cada archivo.')
  if (def.email && (def.split?.by !== 'column' || def.output !== 'files')) {
    errors.push('Para enviar correos hay que separar por columna (la del proveedor) y generar un archivo por grupo.')
  }
  def.sheets.forEach((s, i) => {
    if (!String(s.name || '').trim()) errors.push(`La hoja ${i + 1} no tiene nombre.`)
    if (s.type === 'data' && !(s.source || []).filter(Boolean).length && s.fallback !== 'first') {
      errors.push(`La hoja "${s.name}" no dice de qué hoja del archivo toma los datos.`)
    }
    if (s.type === 'form' && !(s.headers || []).length) errors.push(`La hoja formulario "${s.name}" no tiene encabezados.`)
  })
  ;(def.filters || []).forEach((f, i) => { if (!f.column) errors.push(`El filtro ${i + 1} no tiene columna.`) })
  return errors
}

// Lee el libro según la definición y agrupa las filas. No escribe nada todavía: con esto la UI
// muestra los grupos (ej. proveedores) y el cruce con la base antes de generar.
export function prepareRun(wb, def) {
  const errors = validateDefinition(def)
  if (errors.length) throw new Error(errors[0])

  const splitColumn = def.split?.by === 'column' ? def.split.column : null
  const byHint = def.sheets.map((s) => (s.type === 'data' ? findSheetByHints(wb, s.source) : null))
  const claimed = new Set(byHint.filter(Boolean).map((ws) => ws.id))
  const warnings = []

  const sheets = def.sheets.map((s, i) => {
    if (s.type === 'form') return { def: s, kind: 'form' }
    let ws = byHint[i]
    // "Si no está, usar la primera hoja libre": solo hojas que ninguna otra hoja de salida tomó
    // por su nombre. Si no queda ninguna libre (ej. PACOM de una sola hoja, que ya tomó
    // CONFIRMACION), la hoja se omite en vez de duplicar los mismos datos con otro nombre.
    if (!ws && s.fallback === 'first') {
      ws = wb.worksheets.find((w) => !claimed.has(w.id) && w.actualRowCount > 0) || null
      if (ws) claimed.add(ws.id)
      else return { def: s, kind: 'missing' }
    }
    if (!ws) {
      if (s.optional) return { def: s, kind: 'missing' }
      throw new Error(`El archivo no tiene la hoja "${(s.source || []).join('" ni "')}" que necesita "${s.name}". Hojas del archivo: ${wb.worksheets.map((w) => w.name).join(', ')}.`)
    }

    const table = readTable(ws, { headerRow: s.headerRow || null, splitColumn })
    let columns
    if (!s.columns) {
      columns = table.columns.map((c) => ({ ...c, as: c.name }))
    } else {
      const missing = []
      columns = s.columns.map((c) => {
        const found = findColumn(table, c.from)
        if (!found) missing.push(c.from)
        return found ? { ...found, as: c.as || found.name } : null
      })
      if (missing.length) {
        throw new Error(`La hoja "${ws.name}" no tiene la(s) columna(s) ${missing.map((m) => `"${m}"`).join(', ')} que pide "${s.name}". Columnas del archivo: ${table.columns.map((c) => c.name).join(', ')}.`)
      }
    }
    const splitCol = splitColumn ? findColumn(table, splitColumn) : null
    if (splitColumn && !splitCol) warnings.push(`La hoja "${ws.name}" no tiene la columna "${splitColumn}": va completa en todos los archivos.`)
    const totalCol = s.total ? findColumn(table, s.total) : null
    if (s.total && !totalCol) warnings.push(`La hoja "${ws.name}" no tiene la columna "${s.total}" para el total.`)

    // Filtros: cada uno aplica a las hojas que tengan su columna.
    const filters = (def.filters || [])
      .map((f) => ({ ...f, col: findColumn(table, f.column) }))
      .filter((f) => f.col)
    const includes = filters.filter((f) => f.action !== 'exclude')
    const excludes = filters.filter((f) => f.action === 'exclude')
    const kept = table.rows.filter((row) => {
      const val = (f) => row.findCell(f.col.col)?.value
      if (excludes.some((f) => matches(f, val(f)))) return false
      return includes.every((f) => matches(f, val(f)))
    })

    return { def: s, kind: 'data', ws, table, columns, splitCol, totalCol, kept, filteredOut: table.rows.length - kept.length }
  })

  const dataSheets = sheets.filter((s) => s.kind === 'data')
  if (!dataSheets.length) throw new Error('El archivo no tiene ninguna de las hojas que pide esta configuración.')
  if (splitColumn && !dataSheets.some((s) => s.splitCol)) {
    throw new Error(`Ninguna hoja del archivo tiene la columna "${splitColumn}" para separar. ¿Elegiste el tipo de archivo correcto? Columnas encontradas: ${dataSheets[0].table.columns.map((c) => c.name).join(', ')}.`)
  }

  // ---- Agrupar ----
  const groups = new Map() // clave -> Map(índice de hoja -> filas)
  const addRow = (key, sheetIdx, row) => {
    if (!groups.has(key)) groups.set(key, new Map())
    const g = groups.get(key)
    if (!g.has(sheetIdx)) g.set(sheetIdx, [])
    g.get(sheetIdx).push(row)
  }
  let skippedRows = 0
  const by = def.split?.by || 'none'
  sheets.forEach((s, idx) => {
    if (s.kind !== 'data') return
    if (by === 'column') {
      if (!s.splitCol) return // hoja común: se agrega completa a cada grupo al escribir
      for (const row of s.kept) {
        const key = cellText(row.findCell(s.splitCol.col)?.value)
        // Sin valor (o "0", visto en datos reales) no hay a qué grupo mandarla: se reporta aparte.
        if (!key || key === '0') { skippedRows++; continue }
        addRow(key, idx, row)
      }
    } else if (by === 'rows') {
      const size = Math.max(1, Number(def.split.size) || 1)
      s.kept.forEach((row, i) => addRow(`Parte ${Math.floor(i / size) + 1}`, idx, row))
    } else {
      s.kept.forEach((row) => addRow('Todo', idx, row))
    }
  })

  const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })
  const groupKeys = [...groups.keys()].sort(by === 'rows'
    ? (a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1])
    : collator.compare)

  return {
    def,
    sheets,
    groups,
    groupKeys,
    skippedRows,
    warnings,
    // Para el selector de columnas de una sola corrida (ej. Rotación): solo aplica cuando hay
    // exactamente una hoja de datos y ésta toma "todas las columnas del archivo".
    columnChoices: dataSheets.length === 1 && !dataSheets[0].def.columns
      ? dataSheets[0].columns.map((c) => c.name)
      : null,
  }
}

// ---------------------------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------------------------

export function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120) || 'SIN_NOMBRE'
}

function uniqueSheetName(name, used) {
  const base = String(name).replace(/[[\]:*?/\\]/g, '_').trim().slice(0, 31) || 'Hoja'
  let candidate = base
  for (let n = 2; used.has(candidate.toUpperCase()); n++) {
    const suffix = ` (${n})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(candidate.toUpperCase())
  return candidate
}

const THIN_BLACK = { style: 'thin', color: { argb: 'FF000000' } }
const BOX = { top: THIN_BLACK, right: THIN_BLACK, bottom: THIN_BLACK, left: THIN_BLACK }

function isDarkFill(argb) {
  const hex = String(argb || '').replace(/^#/, '').slice(-6)
  if (hex.length !== 6) return false
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

export function toArgb(color) {
  const hex = String(color || '').replace(/^#/, '').toUpperCase()
  if (/^[0-9A-F]{8}$/.test(hex)) return hex
  if (/^[0-9A-F]{6}$/.test(hex)) return 'FF' + hex
  return 'FFB4C7E7'
}

// Hoja formulario en blanco (encabezados con color + filas vacías con borde) para que el
// proveedor la llene, como la de CONFIRMACION DESCUENTO de Descuentos.
function writeFormSheet(wb, name, spec) {
  const ws = wb.addWorksheet(name)
  const n = spec.headers.length
  ;(spec.notes || []).filter(Boolean).forEach((text) => {
    const row = ws.addRow([text])
    for (let c = 1; c <= n; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
  })
  for (let i = 0; i < (spec.blankBefore || 0); i++) ws.addRow([])
  const hr = ws.addRow(spec.headers.map((h) => h.label))
  hr.height = 34
  spec.headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1)
    const argb = toArgb(h.fill)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
    cell.font = { bold: true, color: { argb: isDarkFill(argb) ? 'FFFFFFFF' : 'FF000000' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = BOX
  })
  ;(spec.staticRows || []).forEach((vals) => {
    const row = ws.addRow(vals)
    row.getCell(1).font = { bold: true }
    for (let c = 1; c <= n; c++) row.getCell(c).border = BOX
  })
  for (let i = 0; i < (spec.emptyRows || 0); i++) {
    const row = ws.addRow([])
    for (let c = 1; c <= n; c++) row.getCell(c).border = BOX
  }
  spec.headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Number(h.width) || Math.min(Math.max(String(h.label).length + 4, 14), 40)
  })
}

// Hoja con datos: cada celda se copia con su valor y su estilo EXACTO del archivo de entrada
// (formato de %, moneda, fechas, colores, fuentes, bordes), igual que los anchos de columna y la
// altura de las filas. Nada se "adivina" por el nombre de la columna.
function writeDataSheet(wb, name, sheet, rows, columns) {
  const ws = wb.addWorksheet(name)
  const src = sheet.table.ws
  const headerSrc = src.getRow(sheet.table.headerRowNumber)
  let r = 1

  if (sheet.totalCol) {
    const raw = rows.reduce((sum, row) => sum + (numberOf(row.findCell(sheet.totalCol.col)?.value) || 0), 0)
    const total = Math.round(raw * 1e9) / 1e9 // evita restos de punto flotante (10.349999999999998)
    const idx = columns.findIndex((c) => c.col === sheet.totalCol.col)
    if (idx >= 0) {
      const cell = ws.getRow(r).getCell(idx + 1)
      cell.value = total
      // Si el archivo ya traía un total arriba del encabezado, se usa ese mismo estilo; si no, el
      // de los datos de esa columna en negrita.
      const above = sheet.table.headerRowNumber > 1 ? src.getRow(sheet.table.headerRowNumber - 1).findCell(sheet.totalCol.col) : null
      const dataStyle = rows[0]?.findCell(sheet.totalCol.col)?.style || {}
      cell.style = above && cellText(above.value) !== ''
        ? above.style
        : { ...dataStyle, font: { ...(dataStyle.font || {}), bold: true } }
    }
    r++
  }

  const headerRow = ws.getRow(r)
  columns.forEach((c, j) => {
    const srcCell = headerSrc.findCell(c.col)
    const cell = headerRow.getCell(j + 1)
    cell.value = c.as
    if (srcCell) cell.style = srcCell.style
  })
  if (headerSrc.height) headerRow.height = headerSrc.height
  r++

  for (const srcRow of rows) {
    const outRow = ws.getRow(r++)
    columns.forEach((c, j) => {
      const srcCell = srcRow.findCell(c.col)
      if (!srcCell) return
      const cell = outRow.getCell(j + 1)
      cell.value = outputValue(srcCell.value)
      cell.style = srcCell.style
    })
    if (srcRow.height) outRow.height = srcRow.height
  }

  columns.forEach((c, j) => {
    const width = src.getColumn(c.col).width
    if (width) ws.getColumn(j + 1).width = width
  })
  return ws
}

function rowsFor(prepared, groupKey, idx) {
  const s = prepared.sheets[idx]
  if (prepared.def.split?.by === 'column' && !s.splitCol) return s.kept // hoja común
  return prepared.groups.get(groupKey)?.get(idx) || []
}

function columnsFor(sheet, columnsOverride) {
  if (!columnsOverride || sheet.def.columns) return sheet.columns
  return sheet.columns.filter((c) => columnsOverride.includes(c.name))
}

// Libro de un grupo (o de todo, si groupKey es null): hojas en el orden de la definición.
function buildGroupWorkbook(prepared, groupKey, columnsOverride) {
  const wb = new ExcelJS.Workbook()
  const used = new Set()
  prepared.sheets.forEach((s, idx) => {
    if (s.kind === 'missing') return
    const name = uniqueSheetName(s.def.name, used)
    if (s.kind === 'form') return writeFormSheet(wb, name, s.def)
    const rows = groupKey == null ? s.kept : rowsFor(prepared, groupKey, idx)
    writeDataSheet(wb, name, s, rows, columnsFor(s, columnsOverride))
  })
  return wb
}

// Un solo libro con una hoja por grupo (y por hoja de datos, si hay varias). Las hojas formulario
// van una sola vez al principio.
function buildSheetsWorkbook(prepared, keys, columnsOverride) {
  const wb = new ExcelJS.Workbook()
  const used = new Set()
  prepared.sheets.forEach((s) => { if (s.kind === 'form') writeFormSheet(wb, uniqueSheetName(s.def.name, used), s.def) })
  const dataIdx = prepared.sheets.map((s, i) => (s.kind === 'data' ? i : -1)).filter((i) => i >= 0)
  for (const key of keys) {
    for (const idx of dataIdx) {
      const s = prepared.sheets[idx]
      const name = uniqueSheetName(dataIdx.length > 1 ? `${key} - ${s.def.name}` : key, used)
      writeDataSheet(wb, name, s, rowsFor(prepared, key, idx), columnsFor(s, columnsOverride))
    }
  }
  return wb
}

// Genera los archivos. Devuelve [{ group, filename, buffer, rowCount }] (+ .skippedRows).
// `onlyGroups`: limita a esos grupos (ej. solo proveedores con correo, o los que el usuario dejó
// marcados en el Separador express). `baseName`: nombre del archivo cuando sale uno solo.
export async function buildFiles(prepared, { prefix = '', onlyGroups = null, columnsOverride = null, baseName = 'separado', onProgress } = {}) {
  const output = prepared.def.split?.by === 'none' ? 'single' : prepared.def.output || 'files'
  const filter = onlyGroups ? new Set(onlyGroups) : null
  const keys = prepared.groupKeys.filter((k) => !filter || filter.has(k))
  if (output !== 'single' && !keys.length) throw new Error('No hay grupos para generar (revisa los filtros o la columna de separación).')
  const out = []

  if (output === 'single') {
    const wb = buildGroupWorkbook(prepared, null, columnsOverride)
    const rowCount = prepared.sheets.reduce((n, s) => n + (s.kind === 'data' ? s.kept.length : 0), 0)
    out.push({ group: null, filename: `${prefix}${sanitizeFileName(baseName)}.xlsx`, buffer: await wb.xlsx.writeBuffer(), rowCount })
  } else if (output === 'sheets') {
    const wb = buildSheetsWorkbook(prepared, keys, columnsOverride)
    const rowCount = keys.reduce((n, k) => n + [...(prepared.groups.get(k)?.values() || [])].reduce((a, r) => a + r.length, 0), 0)
    out.push({ group: null, filename: `${prefix}${sanitizeFileName(baseName)}.xlsx`, buffer: await wb.xlsx.writeBuffer(), rowCount })
  } else {
    const usedNames = new Set()
    let done = 0
    for (const key of keys) {
      const wb = buildGroupWorkbook(prepared, key, columnsOverride)
      let filename = `${prefix}${sanitizeFileName(key)}.xlsx`
      for (let n = 2; usedNames.has(filename.toUpperCase()); n++) filename = `${prefix}${sanitizeFileName(key)}_${n}.xlsx`
      usedNames.add(filename.toUpperCase())
      const rowCount = [...(prepared.groups.get(key)?.values() || [])].reduce((a, r) => a + r.length, 0)
      out.push({ group: key, filename, buffer: await wb.xlsx.writeBuffer(), rowCount })
      onProgress && onProgress(++done, keys.length)
    }
    // Red de seguridad: cada fila agrupada debe haber quedado en exactamente un archivo.
    if (!filter) {
      const grouped = [...prepared.groups.values()].reduce((n, g) => n + [...g.values()].reduce((a, r) => a + r.length, 0), 0)
      const written = out.reduce((n, f) => n + f.rowCount, 0)
      if (grouped !== written) {
        throw new Error(`Validación de datos falló: había ${grouped} filas para separar y se escribieron ${written}. No se generaron los archivos para no perder datos en silencio.`)
      }
    }
  }
  out.skippedRows = prepared.skippedRows
  return out
}
