import { useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import Nav from './components/Nav'
import Login from './components/Login'
import ToastHost from './components/ToastHost'
import ConfirmHost from './components/ConfirmHost'
import SendModal from './components/SendModal'
import Spinner from './components/Spinner'
import ProcesarView from './views/ProcesarView'
import ProveedoresView from './views/ProveedoresView'
import CcView from './views/CcView'
import PlantillaView from './views/PlantillaView'
import { supabase, isConfigured } from './lib/supabase'
import { confirmDialog } from './lib/confirm'

const isDesktop = typeof window !== 'undefined' && window.desktop && window.desktop.isDesktop
const EMPTY_SEND = {
  active: false, total: 0, current: 0, provider: '', cooldown: false,
  done: false, cancelled: false, cancelling: false, sent: [], failed: [], notSent: [], fatal: null,
}

export default function App() {
  const [theme, setTheme] = useState('light')
  const [view, setView] = useState('procesar')
  const [session, setSession] = useState(undefined)
  const [send, setSend] = useState(EMPTY_SEND)

  const [proc, setProc] = useState({
    typeKey: 'PACOM', parsed: null, file: null, prefix: '', selectedCols: [],
  })

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  useEffect(() => {
    if (!isConfigured()) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Progreso del envío (llega del proceso de Electron; sobrevive cambios de pestaña)
  useEffect(() => {
    if (!isDesktop || !window.desktop.onProgress) return
    return window.desktop.onProgress((p) => {
      setSend((s) => {
        if (!s.active || s.done) return s
        if (p.type === 'cooldown') return { ...s, cooldown: true, current: p.current, total: p.total }
        return { ...s, cooldown: false, current: p.current, total: p.total, provider: p.provider }
      })
    })
  }, [])

  async function runSend(emails) {
    const targets = emails.map((e) => e.provider)
    setSend({ ...EMPTY_SEND, active: true, total: emails.length })
    const res = await window.desktop.sendEmails(emails)
    const okSet = new Set((res.results || []).filter((r) => r.ok).map((r) => r.provider))
    const failed = (res.results || []).filter((r) => !r.ok).map((r) => ({ provider: r.provider, message: r.message }))
    const failedSet = new Set(failed.map((f) => f.provider))
    const sent = targets.filter((p) => okSet.has(p))
    const notSent = targets.filter((p) => !okSet.has(p) && !failedSet.has(p))
    setSend((s) => ({ ...s, active: true, done: true, cancelled: !!res.cancelled, fatal: res.fatal || null, sent, failed, notSent, current: s.total }))
  }

  async function requestCancel() {
    const ok = await confirmDialog({
      title: 'Cancelar envío',
      message: 'Se detendrá el envío después del correo en curso. Los correos ya enviados no se pueden deshacer.',
      confirmText: 'Sí, cancelar', danger: true,
    })
    if (!ok) return
    setSend((s) => ({ ...s, cancelling: true }))
    window.desktop.cancelSend && window.desktop.cancelSend()
  }

  const needsAuth = isConfigured()
  if (needsAuth && session === undefined) {
    return (
      <>
        <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>
        <div className="center-loader"><Spinner lg /></div>
      </>
    )
  }
  if (needsAuth && !session) return <Login />

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
          {view === 'procesar' && <ProcesarView state={proc} setState={setProc} runSend={runSend} sendActive={send.active} />}
          {view === 'proveedores' && <ProveedoresView />}
          {view === 'cc' && <CcView />}
          {view === 'plantilla' && <PlantillaView />}
        </div>

        <p className="note">
          Separador &amp; Envío · Cruz Verde
        </p>
      </div>

      {send.active && <SendModal send={send} onCancel={requestCancel} onClose={() => setSend(EMPTY_SEND)} />}
      <ToastHost />
      <ConfirmHost />
    </>
  )
}
