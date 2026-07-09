const TABS = [
  { key: 'procesar', label: 'Procesar archivo' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'cc', label: 'Copia (CC)' },
]

export default function Nav({ view, onChange }) {
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={view === t.key ? 'on' : ''}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
