// Sistema de toasts mínimo (pub/sub), sin dependencias ni context.
const listeners = new Set()
let counter = 0

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(type, message) {
  const t = { id: ++counter, type, message }
  listeners.forEach((l) => l(t))
}

export const toast = {
  success: (m) => emit('success', m),
  error: (m) => emit('error', m),
  info: (m) => emit('info', m),
}
