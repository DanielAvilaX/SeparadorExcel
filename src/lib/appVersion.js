import { supabase, isConfigured } from './supabase'

// Inyectada por vite.config.js desde package.json al compilar.
export const CURRENT_VERSION = __APP_VERSION__

function parse(v) {
  return String(v ?? '').trim().replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
}

// Compara versiones tipo "1.10.0" vs "1.9.0" numero por numero (una comparacion de texto
// simple diria que "1.9.0" > "1.10.0", que es al reves).
export function isNewer(remote, local) {
  const a = parse(remote)
  const b = parse(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x !== y) return x > y
  }
  return false
}

// Consulta la version publicada en Supabase (tabla app_version, actualizada a mano por Daniel
// al publicar un nuevo build) y la compara contra la version compilada en esta copia de la app.
// Devuelve null si no se pudo consultar (sin internet, Supabase no configurado, etc.) -- nunca
// bloquea el uso de la app, solo informa.
export async function checkForUpdate() {
  if (!isConfigured()) return null
  try {
    const { data, error } = await supabase
      .from('app_version')
      .select('version, download_url, changelog')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return null
    return {
      current: CURRENT_VERSION,
      latest: data.version,
      updateAvailable: isNewer(data.version, CURRENT_VERSION),
      downloadUrl: data.download_url || '',
      changelog: data.changelog || '',
    }
  } catch {
    return null
  }
}
