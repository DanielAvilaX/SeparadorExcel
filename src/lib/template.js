import { supabase } from './supabase'

export async function getTemplate() {
  const { data, error } = await supabase.from('email_template').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function saveTemplate({ asunto, cuerpo }) {
  const { error } = await supabase.from('email_template').update({ asunto, cuerpo }).eq('id', 1)
  if (error) throw error
}

// Variables disponibles en asunto/cuerpo.
export const VARS = [
  { token: '{{proveedor}}', label: 'Nombre del proveedor', sample: 'BEIERSDORF SA' },
  { token: '{{correos}}', label: 'Correo(s) del proveedor', sample: 'compras@beiersdorf.com' },
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
