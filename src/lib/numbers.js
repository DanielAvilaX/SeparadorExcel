// Reconoce si un string es "inequívocamente" un número (con o sin separadores), para no
// coercer por error textos alfanuméricos (códigos de proveedor, SKUs, etc.).
function isNumericLike(s) {
  const t = s.trim()
  if (t === '') return false
  return (
    /^\(?-?\$?\s*\d{1,3}(\.\d{3})*(,\d+)?\)?$/.test(t) || // 1.234.567,89  o  1.030
    /^\(?-?\$?\s*\d{1,3}(,\d{3})*(\.\d+)?\)?$/.test(t) || // 1,234,567.89  o  1,030
    /^\(?-?\$?\s*\d+([.,]\d+)?\)?$/.test(t)               // 1030  /  1030.5  /  1030,5
  )
}

// Convierte texto a número con la convención colombiana: "." = miles, "," = decimal. Un solo "."
// (sin coma) se trata como miles, nunca como decimal ("1.030" es mil treinta, no 1,03). "20%" se
// devuelve como fracción (0.2). Devuelve null si no es interpretable como número.
export function parseLocaleNumber(v) {
  if (typeof v === 'number') return v
  if (v == null || v instanceof Date) return null
  let s = String(v).trim()
  if (/%$/.test(s)) {
    const n = parseLocaleNumber(s.slice(0, -1))
    return n === null ? null : n / 100
  }
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
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    const parts = s.split(',')
    const looksThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3)
    s = looksThousands ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (s.includes('.')) {
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}
