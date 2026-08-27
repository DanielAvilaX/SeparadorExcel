import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

// -------- Lectura del archivo subido --------

// Elige la hoja correcta según el tipo (por nombre sugerido).
// `required: true` (hoja principal) cae a la primera hoja si ningún hint coincide.
// `required: false` (hoja opcional, ej. "PROXIMOS A VENCER") devuelve null si no existe --
// nunca "adivina" una hoja para una hoja opcional, porque escribiría datos de la hoja
// equivocada sin ningún aviso.
function pickSheetName(workbook, hints, required) {
  const names = workbook.SheetNames
  for (const hint of hints || []) {
    const found = names.find((n) => n.trim().toLowerCase() === hint.trim().toLowerCase())
    if (found) return found
  }
  return required ? names[0] : null
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

// Normaliza un objeto Date a medianoche UTC "pura" (sin componente de hora).
//
// Por qué: SheetJS (con cellDates:true) construye el Date interpretando el serial de Excel con
// los campos de calendario LOCALES de esta máquina (año/mes/día locales = los del Excel), pero
// un Date de JS guarda internamente un instante absoluto. Si ese mismo objeto se pasa tal cual a
// ExcelJS para escribirlo, ExcelJS calcula el serial de salida a partir del instante absoluto
// (UTC) -- no de los campos locales -- así que sin normalizar, el serial de salida queda con un
// resto fraccionario del tamaño del huso horario de la máquina (ej. 46230 -> 46230.2085 en
// UTC-5), y ese resto SE ACUMULA en cada ciclo lectura->escritura->lectura adicional.
// Verificado con un round-trip real (ver PROXIMOS A VENCER / "Fecha caducidad", que llega con
// formato "General" en el origen): sin este fix el serial escrito ya no es un día exacto.
// Con el fix (reconstruir con Date.UTC a partir de los campos LOCALES), el serial de salida
// vuelve a ser el mismo entero exacto que el de origen.
function normalizeDate(d) {
  if (!(d instanceof Date)) return d
  const normalized = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // FIX: autochequeo barato -- si esto alguna vez no da un día UTC exacto, es mejor fallar
  // fuerte aquí que dejar pasar un serial corrupto en silencio al archivo de salida.
  if (
    normalized.getUTCHours() !== 0 || normalized.getUTCMinutes() !== 0 ||
    normalized.getUTCSeconds() !== 0 || normalized.getUTCMilliseconds() !== 0
  ) {
    throw new Error(`normalizeDate: resultado inesperado para ${d.toISOString()}`)
  }
  return normalized
}

// Detecta columnas de fecha (celdas que sheet_to_json ya devolvió como Date gracias a
// cellDates:true) para poder aplicarles un numFmt de fecha en el archivo de salida, en vez de
// dejarlas "en general" mostrando el número de serie crudo (ej. 46244 en vez de 08/08/2026).
// FIX: además NORMALIZA cada fecha detectada (mutando `rows`, igual que detectNumericColumns
// con los números) para blindar el pipeline contra el desfase de huso horario descrito arriba.
function detectDateColumns(rows, columns) {
  const dates = new Set()
  columns.forEach((col) => {
    if (!col) return
    let sawValue = false
    let allDates = true
    for (const row of rows) {
      const v = row[col]
      if (v === '' || v == null) continue
      sawValue = true
      if (!(v instanceof Date)) {
        allDates = false
        break
      }
    }
    if (sawValue && allDates) {
      dates.add(col)
      for (const row of rows) {
        if (row[col] instanceof Date) row[col] = normalizeDate(row[col])
      }
    }
  })
  return dates
}

// Parsea UNA hoja del workbook ya cargado. Devuelve null si la hoja no existe y no es requerida
// (hoja opcional, ej. una hoja nueva que no todos los archivos traen).
function parseSheetData(workbook, sheetHints, providerColumnHint, required) {
  const sheetName = pickSheetName(workbook, sheetHints, required)
  if (!sheetName) return null
  const sheet = workbook.Sheets[sheetName]

  // raw: true -> nos da el valor crudo de la celda (number, string, boolean, Date), no el texto
  // ya formateado por el motor SSF de SheetJS. Esto evita que el separador de miles/decimales
  // del locale de origen (o de quien reguardó el archivo, ej. Nitro Pro) se filtre como texto y
  // provoque truncamientos o lecturas erróneas (ej. 1.030 -> "103").
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: true })

  const headerIdx = findHeaderRow(matrix, providerColumnHint)
  const columns = (matrix[headerIdx] || []).map((c) => (c == null ? '' : String(c).trim()))

  // El nombre exacto de la columna de proveedor puede variar entre hojas del mismo archivo
  // (ej. "PROVEEDOR" en Lista de productos vs "Proveedor" en Confirmación descuento) o entre
  // versiones del mismo reporte. Los valores de cada fila se indexan por el texto literal del
  // encabezado tal como aparece en el archivo, así que hay que resolverlo de forma insensible a
  // mayúsculas/minúsculas y usar ESE texto (no el de fileTypes.js) de aquí en adelante.
  const providerColumn = providerColumnHint
    ? columns.find((c) => c.toUpperCase() === providerColumnHint.trim().toUpperCase()) || providerColumnHint
    : providerColumnHint

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

  const numericColumns = detectNumericColumns(rows, columns)
  const dateColumns = detectDateColumns(rows, columns)

  return { sheetName, columns, rows, providerColumn, providerColExists, providers, numericColumns, dateColumns }
}

// Parsea a partir de un ArrayBuffer/Uint8Array ya leído (permite mostrar progreso de lectura
// aparte). Lee TODAS las hojas que el tipo necesita (`type.sheets`): la principal (`primary`,
// determina proveedores/columnas que ve la UI) y las opcionales (se omiten si el archivo no las
// trae, sin error).
export function parseBuffer(buf, type) {
  const data = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  // cellDates: true -> las celdas con formato de fecha llegan como objetos Date de JS en vez
  // de su número de serie crudo (ej. 46244). Sin esto, raw:true devuelve el serial y la fecha
  // termina escribiéndose "en general" en el archivo de salida.
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })

  const sheetDefs = type.sheets || []
  const primaryDef = sheetDefs.find((s) => s.primary) || sheetDefs[0]
  if (!primaryDef) throw new Error(`El tipo "${type.key}" no define ninguna hoja de datos (type.sheets).`)

  const primary = parseSheetData(workbook, primaryDef.sheetHints, type.providerColumn, true)

  const extraSheets = {}
  for (const def of sheetDefs) {
    if (def === primaryDef) continue
    const extra = parseSheetData(workbook, def.sheetHints, type.providerColumn, false)
    if (extra) extraSheets[def.key] = extra
  }

  // FIX: la lista de proveedores del archivo es la UNIÓN de los proveedores de TODAS las hojas
  // (no solo la principal). Antes, un proveedor que solo aparecía en una hoja secundaria (ej.
  // "PROXIMOS A VENCER" en Descuentos tiene 65 proveedores que NO están en "DEPURACION") nunca
  // generaba archivo ni recibía correo: sus filas se perdían en silencio porque solo se
  // recorrían los proveedores de la hoja principal. Verificado con datos reales: de 10,150
  // filas de PROXIMOS A VENCER, 5,895 (58%) pertenecían a un proveedor ausente en DEPURACION.
  const providerSet = new Set(primary.providers)
  for (const extra of Object.values(extraSheets)) {
    for (const p of extra.providers) providerSet.add(p)
  }
  const providers = [...providerSet].sort()

  return { ...primary, providers, extraSheets }
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
  lightblue: 'FF00B0F0',
  note: 'FFE2EFDA',
}

// Formato de fecha para columnas detectadas como Date (ver detectDateColumns).
const DATE_FMT = 'd/mm/yyyy'
// Formatos para las dos "familias" de columna numérica con significado propio (ver
// classifyNumericColumn). El resto de columnas numéricas (códigos, SKU, cantidades) se deja en
// General -- sin separador de miles ni signo $ que el archivo de origen no tenía.
// FIX: '0.##%' (con decimales opcionales) deja colgado el separador decimal cuando el
// porcentaje es exacto -- Excel lo renderiza "50.%" (en español "50,%"), como reportado con
// datos reales. Verificado con el propio motor de formato de Excel (XLSX.SSF.format): '0%' es
// la única variante que no arrastra ese separador suelto. Los descuentos reales vistos hasta
// ahora son siempre múltiplos de 5% (15%, 20%, 25%, 35%, 40%, 50%), así que no hay pérdida
// visual en la práctica; si algún día aparece un porcentaje con decimales (ej. 12.5%), la
// CELDA sigue guardando el valor exacto (0.125) -- solo la pantalla redondearía a "13%".
const PERCENT_FMT = '0%'
const MONEY_FMT = '"$ "#,##0.00' // el "," y "." del código son placeholders de Excel: el
// separador de miles/decimales que se ve depende del locale regional de quien abre el archivo
// (en Colombia: "." miles, "," decimales -- igual que la captura que compartiste).

// Clasifica una columna numérica por su NOMBRE (no por sus valores: adivinar por rango de
// valores es frágil -- una columna de "Unidades" en 1 cae en el mismo rango [-1,1] que un
// descuento del 100%, y terminaría mal clasificada). Se basa en las columnas reales de los 3
// tipos de archivo:
//   - Porcentaje: "DCTO", "Descuento minimo", "%DESCUENTO PROVEEDOR", "%DESCUENTO SOLICITADO..."
//   - Dinero:     "VR INVENTARIO", "Costo $"
// Todo lo demás (SKU, Código, CODIGO R11, NIT, INV TOTAL, Unidades, Artículo...) es código/
// identificador o cantidad -- se queda en General.
function classifyNumericColumn(name) {
  const n = (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (n.includes('%') || n.includes('DESCUENTO') || n.includes('DCTO')) return 'percent'
  if (n.includes('$') || n.includes('VR ')) return 'money'
  return null
}

// Hoja "CONFIRMACION DESCUENTO" de Descuentos: plantilla en blanco (sin datos reales de
// entrada, ver nota en fileTypes.js).
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
    cell.font = { bold: true, color: { argb: (h.fill === 'green' || h.fill === 'lightblue') ? 'FFFFFFFF' : 'FF000000' } }
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
  if (v instanceof Date) return DATE_FMT.length
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

// FIX: las columnas numéricas YA NO reciben un numFmt fijo único (antes '#,##0' para todas, sin
// excepción). Ese formato es de "cantidad con separador de miles y sin decimales", y aplicado a
// ciegas rompía columnas que no son cantidades: un código/SKU salía con un punto de separador
// que el archivo de origen nunca tuvo (ej. 547911 -> "547.911"), y una columna de porcentaje
// (ej. "Descuento minimo" = 0.25) se REDONDEABA visualmente a "0" -- el valor seguía guardado
// bien adentro de la celda, pero en Excel se veía como si el descuento fuera cero.
// Ahora cada columna numérica recibe el formato que le corresponde según su naturaleza (ver
// classifyNumericColumn): porcentaje, dinero, o General (códigos/cantidades -- sin separador ni
// redondeo, tal como venían). Las fechas siempre necesitan DATE_FMT (si no, Excel muestra el
// serial crudo, ej. 46230 en vez de una fecha legible).
function applyColumnFormats(ws, columns, numericColumns, dateColumns) {
  columns.forEach((col, i) => {
    if (dateColumns && dateColumns.has(col)) {
      ws.getColumn(i + 1).numFmt = DATE_FMT
      return
    }
    if (numericColumns && numericColumns.has(col)) {
      const kind = classifyNumericColumn(col)
      if (kind === 'percent') ws.getColumn(i + 1).numFmt = PERCENT_FMT
      else if (kind === 'money') ws.getColumn(i + 1).numFmt = MONEY_FMT
      // ninguno de los dos -> se queda en General (código/identificador/cantidad).
    }
  })
}

// Agrega una hoja que REFLEJA 1:1 las columnas del Excel de origen (mismo nombre, mismo orden),
// ya filtradas por proveedor -- ver nota en fileTypes.js sobre por qué ya no hay listas de
// columnas fijas en el código. `totalColumn`, si se da, agrega arriba del encabezado la fila con
// el total en pesos de esa columna (formato DEPURACION original).
function addMirrorSheet(wb, name, rows, columns, numericColumns, dateColumns, totalColumn) {
  const ws = wb.addWorksheet(name)
  let headerRowNumber = 1

  if (totalColumn) {
    const totalIdx = columns.indexOf(totalColumn)
    const total = rows.reduce((s, r) => s + toNumber(r[totalColumn]), 0)
    const totalRow = new Array(columns.length).fill('')
    if (totalIdx >= 0) totalRow[totalIdx] = money(total)
    const tr = ws.addRow(totalRow)
    if (totalIdx >= 0) {
      const cell = tr.getCell(totalIdx + 1)
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'right' }
    }
    headerRowNumber = 2
  }

  ws.addRow(columns)
  rows.forEach((r) => ws.addRow(columns.map((c) => r[c] ?? '')))

  styleHeaderRow(ws.getRow(headerRowNumber))
  bordersFrom(ws, headerRowNumber)
  autoWidth(ws, columns, rows)
  applyColumnFormats(ws, columns, numericColumns, dateColumns)
  return ws
}

// FIX: valida integridad de datos antes de dar por buena una hoja de salida. Se agrega
// explícitamente porque un desajuste entre una lista de columnas fija en el código y el
// encabezado real del Excel de entrada causó antes que una columna completa (el descuento)
// saliera en blanco sin ningún aviso -- ver nota en fileTypes.js. Si vuelve a pasar algo
// parecido (columna que ya no existe, fila que se pierde en el camino), esto revienta con un
// error claro en vez de generar un ZIP con datos faltantes en silencio.
function assertSheetIntegrity(label, sourceColumns, outputColumns, sourceRowCount, writtenRowCount) {
  const missing = outputColumns.filter((c) => !sourceColumns.includes(c))
  if (missing.length) {
    throw new Error(
      `Validación de datos falló en "${label}": la(s) columna(s) ${missing.join(', ')} no existen en el ` +
      `encabezado del archivo de origen (${sourceColumns.join(', ')}). No se generó el archivo para no ` +
      `perder datos en silencio -- revisa si el formato del Excel cambió.`
    )
  }
  if (sourceRowCount !== writtenRowCount) {
    throw new Error(
      `Validación de datos falló en "${label}": el origen tenía ${sourceRowCount} fila(s) con proveedor y se ` +
      `escribieron ${writtenRowCount}. No se generó el archivo para no perder datos en silencio.`
    )
  }
}

// Construye el workbook de un proveedor: la hoja de confirmación estática (si el tipo la
// define) + una hoja por cada entrada de `type.sheets`, en orden.
function buildProviderWorkbook(provider, type, primaryRows, columns, numericColumns, dateColumns, extraSheets, extraGroups) {
  const wb = new ExcelJS.Workbook()
  if (type.confirmacion) addConfirmacionSheet(wb, type.confirmacion)

  for (const def of type.sheets) {
    if (def.primary) {
      addMirrorSheet(wb, def.outputName, primaryRows, columns, numericColumns, dateColumns, def.totalColumn)
    } else {
      const extra = extraSheets && extraSheets[def.key]
      const rows = extra ? (extraGroups[def.key].get(provider) || []) : []
      const cols = extra ? extra.columns : []
      addMirrorSheet(wb, def.outputName, rows, cols, extra?.numericColumns, extra?.dateColumns, def.totalColumn)
    }
  }
  return wb
}

// Genera un archivo Excel por proveedor. Devuelve [{ provider, filename, buffer }].
export async function buildProviderFiles({ rows, columns, providerColumn, prefix = '', type = null, onlyProviders = null, numericColumns = null, dateColumns = null, extraSheets = null }) {
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
  // FIX: filas sin proveedor identificable (columna vacía O literalmente 0, visto en datos
  // reales de "PROXIMOS A VENCER") -- no tienen a dónde ir, así que no entran en ningún
  // archivo. `skippedRows` (el total que se le reporta al usuario) suma TODAS las hojas; cada
  // hoja también guarda su propio conteo (`primarySkipped`/`extraSkipped` más abajo) para el
  // chequeo de integridad, que debe validar cada hoja contra SU PROPIO total, no el agregado.
  const primarySkipped = rows.length - [...groups.values()].reduce((s, arr) => s + arr.length, 0)
  let skippedRows = primarySkipped

  // Agrupa también cada hoja extra por SU PROPIO proveedor (el nombre de columna puede variar
  // entre hojas, ej. "Proveedor" vs "PROVEEDOR"; ya viene resuelto por hoja desde parseBuffer).
  const extraGroups = {}
  const extraSkippedByKey = {}
  if (type?.sheets) {
    for (const def of type.sheets) {
      if (def.primary) continue
      const extra = extraSheets && extraSheets[def.key]
      extraGroups[def.key] = extra ? groupByProvider(extra.rows, extra.providerColumn) : new Map()
      if (extra) {
        const extraSkipped = extra.rows.length - [...extraGroups[def.key].values()].reduce((s, arr) => s + arr.length, 0)
        extraSkippedByKey[def.key] = extraSkipped
        skippedRows += extraSkipped
      }
    }
  }

  // FIX: valida, antes de generar ningún archivo, que cada hoja mirror vaya a reflejar
  // exactamente sus columnas de origen (ver assertSheetIntegrity). Con reflejo dinámico esto es
  // tautológico hoy, pero es la red de seguridad si en el futuro alguien vuelve a fijar una
  // lista de columnas a mano.
  if (type?.sheets) {
    for (const def of type.sheets) {
      if (def.primary) {
        assertSheetIntegrity(def.outputName, columns, columns, rows.length - primarySkipped, [...groups.values()].reduce((s, a) => s + a.length, 0))
      } else if (extraSheets && extraSheets[def.key]) {
        const extra = extraSheets[def.key]
        assertSheetIntegrity(def.outputName, extra.columns, extra.columns, extra.rows.length - extraSkippedByKey[def.key], [...extraGroups[def.key].values()].reduce((s, a) => s + a.length, 0))
      }
    }
  }

  // FIX: universo de proveedores = UNIÓN entre la hoja principal y todas las hojas extra, no
  // solo la principal -- para no perder proveedores que solo tienen filas en una hoja
  // secundaria (ver nota en parseBuffer sobre PROXIMOS A VENCER).
  const allProviders = new Set(groups.keys())
  for (const g of Object.values(extraGroups)) {
    for (const p of g.keys()) allProviders.add(p)
  }

  for (const provider of allProviders) {
    if (filter && !filter.has(provider)) continue
    const providerRows = groups.get(provider) || []
    const wb = type?.sheets
      ? buildProviderWorkbook(provider, type, providerRows, columns, numericColumns, dateColumns, extraSheets, extraGroups)
      : await (async () => {
        // Fallback defensivo: no debería pasar (todos los tipos definen `sheets`), pero evita
        // dejar al usuario sin archivo si algún tipo llega mal configurado.
        const w = new ExcelJS.Workbook()
        addMirrorSheet(w, 'Datos', providerRows, columns, numericColumns, dateColumns)
        return w
      })()
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
export async function generateZip({ rows, columns, providerColumn, prefix = '', onlyProviders = null, type = null, numericColumns = null, dateColumns = null, extraSheets = null }) {
  const files = await buildProviderFiles({ rows, columns, providerColumn, prefix, type, onlyProviders, numericColumns, dateColumns, extraSheets })
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
