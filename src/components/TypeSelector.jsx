import { FILE_TYPES } from '../lib/fileTypes'

export default function TypeSelector({ selected, onSelect }) {
  return (
    <div className="types">
      {FILE_TYPES.map((t) => {
        if (!t.enabled) {
          return (
            <button key={t.key} className="card soon" type="button" disabled aria-disabled="true">
              <span className="badge-soon">Próximamente</span>
              <span className="ico">{t.icon}</span>
              <h3>{t.label}</h3>
              <small>{t.description}</small>
            </button>
          )
        }
        const on = t.key === selected
        return (
          <button
            key={t.key}
            className={'card' + (on ? ' on' : '')}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(t.key)}
          >
            <span className="check" aria-hidden="true"></span>
            <span className="ico">{t.icon}</span>
            <h3>{t.label}</h3>
            <small>{t.description}</small>
          </button>
        )
      })}
    </div>
  )
}
