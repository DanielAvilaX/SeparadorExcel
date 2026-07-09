import { useEffect, useRef, useState } from 'react'
import { registerConfirm } from '../lib/confirm'

export default function ConfirmHost() {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  useEffect(() => {
    registerConfirm((opts) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setState({ ...opts, leaving: false })
      })
    )
  }, [])

  function close(value) {
    const r = resolver.current
    setState((s) => (s ? { ...s, leaving: true } : s))
    setTimeout(() => {
      setState(null)
      resolver.current = null
      if (r) r(value)
    }, 170)
  }

  useEffect(() => {
    if (!state) return
    function onKey(e) {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

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
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={() => close(false)}>
            {state.cancelText || 'Cancelar'}
          </button>
          <button
            className={'btn ' + (state.danger ? 'btn-danger' : 'btn-primary')}
            type="button"
            autoFocus
            onClick={() => close(true)}
          >
            {state.confirmText || 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
