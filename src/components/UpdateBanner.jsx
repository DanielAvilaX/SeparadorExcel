// Aviso de que hay una version mas nueva publicada (ver src/lib/appVersion.js).
// No bloquea nada. En la app de escritorio descarga e instala desde aca mismo (sin abrir GitHub);
// en la version web solo deja el link de descarga.
const isDesktop = typeof window !== 'undefined' && window.desktop && window.desktop.isDesktop

const formatMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1)

// Las notas del Release vienen en Markdown ("## Novedades", "- ..."): se muestran como una
// linea corta de texto plano en vez de los simbolos crudos.
function summarize(md) {
  const text = String(md || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/\*\*/g, ''))
    .join(' ')
  return text.length > 220 ? text.slice(0, 217).trimEnd() + '…' : text
}

export function UpdateProgress({ upd }) {
  const p = upd.progress
  return (
    <div style={{ width: '100%' }}>
      <p className="progress-label" style={{ margin: '0 0 8px' }}>
        Descargando actualización…{' '}
        {p?.percent != null ? `${p.percent}% (${formatMB(p.downloaded)} MB de ${formatMB(p.total)} MB)` : ''}
      </p>
      <div className="progress"><i style={{ width: `${p?.percent ?? 0}%` }} /></div>
    </div>
  )
}

export default function UpdateBanner({ info, upd, onStart, onCloseToInstall, onDismiss }) {
  if (!info || !info.updateAvailable) return null
  const inApp = isDesktop && info.canAutoInstall && info.downloadUrl

  return (
    <div
      className="glass"
      style={{
        borderLeft: '4px solid var(--warn)',
        padding: '14px 18px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      {inApp && upd.status === 'downloading' ? (
        <UpdateProgress upd={upd} />
      ) : inApp && upd.status === 'ready' ? (
        <>
          <div style={{ flex: 1, minWidth: 220 }}>
            <b>Actualización v{info.latest} lista</b>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              Dale a "Cerrar y actualizar": la app se cierra y en unos segundos se vuelve a abrir sola con la versión nueva.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={onCloseToInstall}>Cerrar y actualizar</button>
        </>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 220 }}>
            <b>Hay una nueva versión disponible: v{info.latest}</b>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              Estás usando la v{info.current}.{' '}
              {summarize(info.changelog) || 'Descarga la última versión para tener las últimas correcciones.'}
            </p>
            {upd.status === 'error' && (
              <p className="hint" style={{ margin: '6px 0 0', color: 'var(--bad)' }}>{upd.error}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            {inApp ? (
              <button className="btn btn-primary" type="button" onClick={() => onStart(info.downloadUrl)}>
                {upd.status === 'error' ? 'Reintentar' : 'Descargar e instalar'}
              </button>
            ) : info.downloadUrl && (
              <a
                className="btn btn-primary"
                href={info.downloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                Descargar
              </a>
            )}
            <button className="btn btn-ghost" type="button" onClick={onDismiss}>Ahora no</button>
          </div>
        </>
      )}
    </div>
  )
}
