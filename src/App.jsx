import { useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import Nav from './components/Nav'
import ProcesarView from './views/ProcesarView'
import ProveedoresView from './views/ProveedoresView'
import CcView from './views/CcView'

export default function App() {
  const [theme, setTheme] = useState('light')
  const [view, setView] = useState('procesar')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <>
      <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>

      <div className="wrap">
        <TopBar theme={theme} onToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
        <Nav view={view} onChange={setView} />

        {view === 'procesar' && <ProcesarView />}
        {view === 'proveedores' && <ProveedoresView />}
        {view === 'cc' && <CcView />}

        <p className="note">
          Fase 2 · base de proveedores en Supabase · login, pantalla de revisión y correo en las siguientes fases
        </p>
      </div>
    </>
  )
}
