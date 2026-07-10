export default function SendModal({ send, onCancel, onClose }) {
  const { total, current, provider, cooldown, done, cancelled, fatal, cancelling } = send
  const sent = send.sent || []
  const failed = send.failed || []
  const notSent = send.notSent || []
  const pct = total ? Math.round((current / total) * 100) : 0

  return (
    <div className="modal-overlay send-overlay">
      <div className="modal send-modal" role="dialog" aria-modal="true">
        {!done ? (
          <>
            <h3>Enviando correos…</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              No cierres la app. Puedes seguir trabajando; el envío continúa aquí.
            </p>

            <div className="progress" style={{ marginTop: 16 }}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="send-count">{current}/{total} correos · {pct}%</div>
            <div className="send-current">
              {cooldown
                ? '⏸ Pausa breve para no saturar el correo…'
                : provider
                  ? <>Enviando a: <b>{provider}</b></>
                  : 'Preparando…'}
            </div>

            <div className="modal-actions">
              <button className="btn btn-danger" type="button" disabled={cancelling} onClick={onCancel}>
                {cancelling ? 'Cancelando…' : 'Cancelar envío'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{cancelled ? 'Envío cancelado' : 'Envío completado'}</h3>
            {fatal && <div className="banner bad" style={{ marginTop: 10 }}>{fatal}</div>}
            {cancelled && !fatal && (
              <p className="muted" style={{ marginTop: 4 }}>Se detuvo el envío. Este es el resumen de lo que alcanzó a salir:</p>
            )}

            <div className="review-grid" style={{ marginTop: 14 }}>
              <div className="rev good">
                <h4><span className="dot" /> Enviados <span className="count">{sent.length}</span></h4>
                {sent.length
                  ? <div className="chips">{sent.map((p) => <span key={p} className="chip g">{p}</span>)}</div>
                  : <p className="muted">Ninguno</p>}
              </div>
              <div className="rev warn">
                <h4><span className="dot" /> No enviados <span className="count">{failed.length + notSent.length}</span></h4>
                {failed.length + notSent.length === 0
                  ? <p className="muted">Todos salieron. 🎉</p>
                  : (
                    <div className="chips">
                      {failed.map((f) => <span key={f.provider} className="chip w" title={f.message}>{f.provider}</span>)}
                      {notSent.map((p) => <span key={p} className="chip w" title="no alcanzado">{p}</span>)}
                    </div>
                  )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" type="button" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
