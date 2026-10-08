export default function TypeSelector({ configs, selected, onSelect }) {
  return (
    <div className="types">
      {configs.map((t) => {
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
            <small>{t.description || (t.definition.email ? 'Separa y envía por correo.' : 'Separa y descarga.')}</small>
          </button>
        )
      })}
    </div>
  )
}
