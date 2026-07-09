// Confirmación con modal propio (promesa). ConfirmHost registra el manejador.
let handler = null

export function registerConfirm(fn) { handler = fn }

// Devuelve Promise<boolean>. Fallback al confirm nativo si no hay host montado.
export function confirmDialog(opts) {
  if (handler) return handler(typeof opts === 'string' ? { message: opts } : opts)
  return Promise.resolve(window.confirm(typeof opts === 'string' ? opts : opts.message))
}
