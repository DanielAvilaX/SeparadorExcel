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
//
// Devuelve null solo cuando no hay nada que consultar (Supabase no configurado) -- para el chequeo
// silencioso automatico de App.jsx, que nunca debe molestar al usuario si falla. Cuando SÍ se
// intentó consultar y falló, devuelve { error } con un mensaje que explica la causa real (la
// tabla no existe todavía, no hay sesión, sin internet, etc.) para que un chequeo manual (botón
// "Buscar actualización ahora" en Configuración) pueda mostrarla en vez de un "sin internet?"
// genérico que despista cuando el problema real es, por ejemplo, que falta correr la migración.
export async function checkForUpdate() {
  if (!isConfigured()) return null
  try {
    const { data, error } = await supabase
      .from('app_version')
      .select('version, download_url, changelog')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      console.error('checkForUpdate:', error)
      const missingTable = error.code === '42P01' || error.code === 'PGRST205'
        || /relation .* does not exist/i.test(error.message || '')
        || /could not find the table/i.test(error.message || '')
      return {
        current: CURRENT_VERSION, latest: null, updateAvailable: false, downloadUrl: '', changelog: '',
        error: missingTable
          ? 'Falta crear la tabla de versión en Supabase: ejecuta supabase/migracion-version-app.sql en el SQL Editor.'
          : `No se pudo consultar la versión (${error.message}).`,
      }
    }
    if (!data) {
      return {
        current: CURRENT_VERSION, latest: null, updateAvailable: false, downloadUrl: '', changelog: '',
        error: 'La tabla de versión existe pero no tiene ninguna fila. Revisa supabase/migracion-version-app.sql.',
      }
    }
    return {
      current: CURRENT_VERSION,
      latest: data.version,
      updateAvailable: isNewer(data.version, CURRENT_VERSION),
      downloadUrl: data.download_url || '',
      changelog: data.changelog || '',
      error: null,
    }
  } catch (e) {
    console.error('checkForUpdate:', e)
    return {
      current: CURRENT_VERSION, latest: null, updateAvailable: false, downloadUrl: '', changelog: '',
      error: 'No se pudo consultar la versión. Revisa tu conexión a internet.',
    }
  }
}
