import { useEffect, useRef, useState } from 'react'
import { registerConfirm } from '../lib/confirm'

export default function ConfirmHost() {
  const [state, setState] = useState(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef(null)

  useEffect(() => {
    registerConfirm((opts) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setTyped('')
        setState({ ...opts, leaving: false })
      })
    )
  }, [])

  function close(value) {
    const r = resolver.current
    setState((s) => (s ? { ...s, leaving: true } : s))
    setTimeout(() => {
      setState(null)
      setTyped('')
      resolver.current = null
      if (r) r(value)
    }, 170)
  }

  const needsText = state && state.requireText
  const canConfirm = !needsText || typed.trim() === state.requireText.trim()

  useEffect(() => {
    if (!state) return
    function onKey(e) {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter' && canConfirm && !needsText) close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, canConfirm, needsText])

  if (!state) return null

  return (
    <div className={'modal-overlay' + (state.leaving ? ' leaving' : '')} onClick={() => close(false)}>
      <div
        className={'modal' + (state.leaving ? ' leaving' : '')}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{state.title || 'Confirmar'}</h3>
        <p>{state.message}</p>

        {needsText && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ marginBottom: 8 }}>
              Para confirmar, escribe exactamente (sin copiar y pegar):<br />
              <b style={{ color: 'var(--ink)' }}>{state.requireText}</b>
            </p>
            <input
              className="input"
              value={typed}
              autoFocus
              placeholder="Escribe aquí la frase…"
              onChange={(e) => setTyped(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={() => close(false)}>
            {state.cancelText || 'Cancelar'}
          </button>
          <button
            className={'btn ' + (state.danger ? 'btn-danger' : 'btn-primary')}
            type="button"
            disabled={!canConfirm}
            onClick={() => close(true)}
          >
            {state.confirmText || 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
