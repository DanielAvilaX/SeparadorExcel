import { useState } from 'react'
import { FileSpreadsheet, Users, Mail, FileText, LogOut, ChevronRight } from 'lucide-react'
import logo from '../../assets/logo-separador.png'
import { CURRENT_VERSION } from '../lib/appVersion'

const NAV_ITEMS = [
  { key: 'procesar', label: 'Procesar archivo', icon: FileSpreadsheet },
  { key: 'proveedores', label: 'Proveedores', icon: Users },
  { key: 'cc', label: 'Copias (CC)', icon: Mail },
  { key: 'plantilla', label: 'Plantilla', icon: FileText },
]

// Envuelve una etiqueta para que aparezca/desaparezca con una animación de ancho+opacidad en vez
// de un salto brusco al colapsar/expandir la barra (mismo truco que usa el dashboard de
// job-hunter: "block" es obligatorio porque max-width no tiene efecto en elementos inline).
function Label({ collapsed, children }) {
  return (
    <span className={`sb-label${collapsed ? ' is-collapsed' : ''}`}>{children}</span>
  )
}

export default function Sidebar({ view, onChange, userEmail, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'MM'
  const label = userEmail || 'María Morales'

  return (
    <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <button
        className="sb-collapse-btn"
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expandir' : 'Colapsar'}
      >
        <ChevronRight className={collapsed ? '' : 'is-flipped'} size={13} strokeWidth={2.5} />
      </button>

      <div className="sidebar-inner">
        <div className="sb-brand">
          <img className="mark" src={logo} alt="" aria-hidden="true" />
          <Label collapsed={collapsed}>
            <p className="sb-brand-title">Separador &amp; Envío</p>
            <p className="sb-brand-sub">Cruz Verde</p>
          </Label>
        </div>

        <nav className="sb-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = view === item.key
            return (
              <button
                key={item.key}
                type="button"
                title={item.label}
                className={`sb-item${active ? ' is-active' : ''}`}
                onClick={() => onChange(item.key)}
              >
                <Icon size={18} strokeWidth={2} className="sb-item-ico" />
                <Label collapsed={collapsed}>{item.label}</Label>
              </button>
            )
          })}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <span className="av">{initials}</span>
            <Label collapsed={collapsed}>
              <span className="sb-user-email" title={label}>{label}</span>
            </Label>
          </div>
          {onLogout && (
            <button className="sb-item sb-logout" type="button" title="Cerrar sesión" onClick={onLogout}>
              <LogOut size={18} strokeWidth={2} className="sb-item-ico" />
              <Label collapsed={collapsed}>Salir</Label>
            </button>
          )}
          <Label collapsed={collapsed}>
            <p className="sb-version">v{CURRENT_VERSION}</p>
          </Label>
        </div>
      </div>
    </aside>
  )
}
