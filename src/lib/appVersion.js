// Inyectada por vite.config.js desde package.json al compilar.
export const CURRENT_VERSION = __APP_VERSION__

// Repo público de GitHub: la API de releases se puede consultar sin autenticación (no hace
// falta meter ningún token dentro de la app distribuida).
const GITHUB_REPO = 'DanielAvilaX/SeparadorExcel'

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

// Consulta el último Release publicado en GitHub y lo compara contra la version compilada en
// esta copia de la app. Nunca descarga ni instala nada solo -- solo informa (el botón de
// "Descargar" del banner abre el link en el navegador, y el usuario decide cuándo actualizar).
//
// Por qué GitHub y no una tabla en Supabase (como se hizo al principio): así Daniel no tiene
// que acordarse de actualizar una fila a mano cada vez que publica un build -- basta con crear
// el Release en GitHub (`gh release create vX.Y.Z archivo.zip`) y listo, la app lo detecta sola.
//
// Devuelve { error } con un mensaje explicando la causa real (sin internet, límite de peticiones
// de GitHub, todavía no existe ningún Release, etc.) para que el chequeo manual ("Buscar
// actualización ahora" en Configuración) pueda mostrarla en vez de un "sin internet?" genérico.
export async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (res.status === 404) {
      // Repo válido, pero todavía no se ha publicado ningún Release -- no es un error real.
      return { current: CURRENT_VERSION, latest: null, updateAvailable: false, downloadUrl: '', changelog: '', error: null }
    }
    if (res.status === 403) {
      return {
        current: CURRENT_VERSION, latest: null, updateAvailable: false, downloadUrl: '', changelog: '',
        error: 'GitHub limitó las consultas desde esta red por un momento. Intenta de nuevo en un rato.',
      }
    }
    if (!res.ok) {
      return {
        current: CURRENT_VERSION, latest: null, updateAvailable: false, downloadUrl: '', changelog: '',
        error: `No se pudo consultar GitHub (código ${res.status}).`,
      }
    }

    const release = await res.json()
    const latest = release.tag_name
    // Se prefiere el primer .zip adjunto al Release; si no hay ninguno adjunto, se manda a la
    // propia página del Release (ahí igual puede bajarlo a mano).
    const asset = (release.assets || []).find((a) => a.name.toLowerCase().endsWith('.zip'))
    const downloadUrl = asset ? asset.browser_download_url : release.html_url

    return {
      current: CURRENT_VERSION,
      latest,
      updateAvailable: isNewer(latest, CURRENT_VERSION),
      downloadUrl,
      changelog: release.body || '',
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
