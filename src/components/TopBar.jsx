export default function TopBar({ theme, onToggle, userEmail, onLogout }) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'MM'
  const label = userEmail || 'María Morales'
  return (
    <header className="bar">
      <div className="brand">
        <div className="mark" aria-hidden="true"></div>
        <div>
          <h1>Separador &amp; Envío · Cruz Verde</h1>
          <p>Divide por proveedor y envía cada archivo a su correo</p>
        </div>
      </div>
      <div className="bar-right">
        <button className="toggle" type="button" onClick={onToggle} aria-label="Cambiar tema">
          {theme === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
        </button>
        <div className="user">
          <span className="av">{initials}</span> {label}
          {onLogout && (
            <button className="mini del" style={{ marginLeft: 8 }} onClick={onLogout}>Salir</button>
          )}
        </div>
      </div>
    </header>
  )
}
