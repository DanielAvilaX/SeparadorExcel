import { supabase } from './supabase'

// -------- Plantillas (varias) --------

export async function listTemplates() {
  const { data, error } = await supabase.from('email_templates').select('*').order('nombre')
  if (error) throw error
  return data
}

export async function getTemplateById(id) {
  const { data, error } = await supabase.from('email_templates').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createTemplate({ nombre, asunto = '', cuerpo = '' }) {
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ nombre: nombre.trim(), asunto, cuerpo })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTemplate(id, { nombre, asunto, cuerpo }) {
  const { error } = await supabase
    .from('email_templates')
    .update({ nombre: nombre.trim(), asunto, cuerpo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('email_templates').delete().eq('id', id)
  if (error) throw error
}

// Variables disponibles en asunto/cuerpo.
export const VARS = [
  { token: '{{proveedor}}', label: 'Nombre del proveedor', sample: 'BEIERSDORF SA' },
  { token: '{{mes}}', label: 'Mes actual', sample: 'agosto' },
]

// Reemplaza las variables por sus valores.
export function render(text, values) {
  let out = text || ''
  for (const [k, v] of Object.entries(values)) {
    out = out.replaceAll(`{{${k}}}`, v ?? '')
  }
  return out
}

// -------- Cuerpo enriquecido (HTML con imágenes) --------

const looksLikeHtml = (s) => /<[a-z][\s\S]*>/i.test(s || '')

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Las plantillas viejas eran texto plano: se convierten a HTML conservando los saltos de línea.
export function bodyToHtml(body) {
  if (!body) return ''
  return looksLikeHtml(body) ? body : escapeHtml(body).replace(/\n/g, '<br>')
}

// Outlook no muestra imágenes en base64 dentro del HTML: hay que adjuntarlas como
// imágenes en línea (CID). Esto saca cada <img src="data:..."> y la reemplaza por cid:.
export function extractInlineImages(html) {
  const images = []
  if (!html) return { html: '', images }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  doc.body.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(src)
    if (!m) return
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
    const cid = `img${images.length + 1}.separador`
    images.push({ cid, name: `imagen${images.length + 1}.${ext}`, b64: m[2] })
    img.setAttribute('src', `cid:${cid}`)
  })
  return { html: doc.body.innerHTML, images }
}

// Valores de ejemplo para las vistas previas.
export const SAMPLE = { proveedor: 'BEIERSDORF SA', correos: 'compras@beiersdorf.com', mes: 'agosto' }

// Envuelve el cuerpo en un HTML de correo simple y legible.
export function wrapEmailHtml(inner) {
  return `<html><body style="font-family:Calibri,Segoe UI,Arial,sans-serif;font-size:11pt;color:#201f1e;">${inner}</body></html>`
}
