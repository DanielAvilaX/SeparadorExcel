import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../../assets/logo-separador.png'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next)
    setErr('')
    setInfo('')
    setPw('')
    setPw2('')
  }

  async function submitSignIn(e) {
    e.preventDefault()
    setErr(''); setInfo('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    if (error) setErr('Correo o contraseña incorrectos.')
    setBusy(false)
  }

  async function submitSignUp(e) {
    e.preventDefault()
    setErr(''); setInfo('')
    if (pw.length < 6) return setErr('La contraseña debe tener al menos 6 caracteres.')
    if (pw !== pw2) return setErr('Las contraseñas no coinciden.')

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) {
      setErr(error.message.includes('already registered') || error.message.includes('already exists')
        ? 'Ya existe una cuenta con ese correo. Inicia sesión en vez de registrarte.'
        : 'No se pudo crear la cuenta. Intenta de nuevo.')
      return
    }
    // Si el proyecto de Supabase exige confirmar el correo, todavía no hay sesión activa.
    if (data.user && !data.session) {
      setInfo('Cuenta creada. Revisa tu correo y confirma tu cuenta antes de iniciar sesión.')
      switchMode('signin')
    }
    // Si no exige confirmación, onAuthStateChange en App.jsx ya recibe la sesión y entra solo.
  }

  return (
    <>
      <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>
      <div className="login-wrap">
        <form className="glass login-card" onSubmit={mode === 'signin' ? submitSignIn : submitSignUp}>
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 20 }}>
            <img className="mark" src={logo} alt="" aria-hidden="true" />
            <div>
              <h1>Separador &amp; Envío</h1>
              <p>{mode === 'signin' ? 'Ingresa para continuar' : 'Crea tu cuenta'}</p>
            </div>
          </div>

          <div className="field">
            <label>Correo</label>
            <input className="input" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@cruzverde.com.co" required />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Contraseña</label>
            <input className="input" type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={pw}
              onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
          </div>
          {mode === 'signup' && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Repite la contraseña</label>
              <input className="input" type="password" autoComplete="new-password" value={pw2}
                onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" required />
            </div>
          )}

          {err && <p className="hint" style={{ color: 'var(--bad)' }}>{err}</p>}
          {info && <p className="hint" style={{ color: 'var(--warn)' }}>{info}</p>}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={busy}>
            {busy
              ? (mode === 'signin' ? 'Ingresando…' : 'Creando cuenta…')
              : (mode === 'signin' ? 'Ingresar' : 'Crear cuenta')}
          </button>

          <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
            {mode === 'signin' ? (
              <>¿No tienes cuenta?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signup') }}>Regístrate</a>
              </>
            ) : (
              <>¿Ya tienes cuenta?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signin') }}>Inicia sesión</a>
              </>
            )}
          </p>
        </form>
      </div>
    </>
  )
}
