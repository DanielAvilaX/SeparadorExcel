// Aviso de que hay una version mas nueva publicada (ver src/lib/appVersion.js).
// No bloquea nada -- solo informa y deja un link para descargar la version nueva.
export default function UpdateBanner({ info, onDismiss }) {
  if (!info || !info.updateAvailable) return null

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
      <div style={{ flex: 1, minWidth: 220 }}>
        <b>Hay una nueva versión disponible: v{info.latest}</b>
        <p className="hint" style={{ margin: '4px 0 0' }}>
          Estás usando la v{info.current}.{' '}
          {info.changelog || 'Descarga la última versión para tener las últimas correcciones.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        {info.downloadUrl && (
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
    </div>
  )
}
