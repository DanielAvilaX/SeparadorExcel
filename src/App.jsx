import { useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import Nav from './components/Nav'
import Login from './components/Login'
import ToastHost from './components/ToastHost'
import Spinner from './components/Spinner'
import ProcesarView from './views/ProcesarView'
import ProveedoresView from './views/ProveedoresView'
import CcView from './views/CcView'
import PlantillaView from './views/PlantillaView'
import { supabase, isConfigured } from './lib/supabase'

export default function App() {
  const [theme, setTheme] = useState('light')
  const [view, setView] = useState('procesar')
  const [session, setSession] = useState(undefined) // undefined = cargando

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!isConfigured()) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Con Supabase configurado exigimos login. Sin configurar (dev), se omite.
  const needsAuth = isConfigured()
  if (needsAuth && session === undefined) {
    return (
      <>
        <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>
        <div className="center-loader"><Spinner lg /></div>
      </>
    )
  }
  if (needsAuth && !session) {
    return <Login />
  }

  const userEmail = session?.user?.email

  return (
    <>
      <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>

      <div className="wrap">
        <TopBar
          theme={theme}
          onToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          userEmail={userEmail}
          onLogout={needsAuth ? () => supabase.auth.signOut() : null}
        />
        <Nav view={view} onChange={setView} />

        <div className="view" key={view}>
          {view === 'procesar' && <ProcesarView />}
          {view === 'proveedores' && <ProveedoresView />}
          {view === 'cc' && <CcView />}
          {view === 'plantilla' && <PlantillaView />}
        </div>

        <p className="note">
          Separador &amp; Envío · Cruz Verde · el envío de correo se habilita tras la prueba de acceso de Microsoft
        </p>
      </div>

      <ToastHost />
    </>
  )
}
