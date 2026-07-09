import { useEffect, useState } from 'react'
import { subscribe } from '../lib/toast'

export default function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    return subscribe((t) => {
      setItems((x) => [...x, t])
      setTimeout(() => {
        setItems((x) => x.map((i) => (i.id === t.id ? { ...i, leaving: true } : i)))
      }, 3000)
      setTimeout(() => {
        setItems((x) => x.filter((i) => i.id !== t.id))
      }, 3350)
    })
  }, [])

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast ' + t.type + (t.leaving ? ' leaving' : '')}>
          <span className="toast-ico" aria-hidden="true" />
          {t.message}
        </div>
      ))}
    </div>
  )
}
