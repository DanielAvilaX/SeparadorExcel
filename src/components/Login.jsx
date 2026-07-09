import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    if (error) setErr('Correo o contraseña incorrectos.')
    setBusy(false)
  }

  return (
    <>
      <div className="atmos"><span className="b1" /><span className="b2" /><span className="b3" /></div>
      <div className="login-wrap">
        <form className="glass login-card" onSubmit={submit}>
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 20 }}>
            <div className="mark" aria-hidden="true" />
            <div>
              <h1>Separador &amp; Envío</h1>
              <p>Ingresa para continuar</p>
            </div>
          </div>

          <div className="field">
            <label>Correo</label>
            <input className="input" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@cruzverde.com.co" required />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Contraseña</label>
            <input className="input" type="password" autoComplete="current-password" value={pw}
              onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
          </div>

          {err && <p className="hint" style={{ color: 'var(--bad)' }}>{err}</p>}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </>
  )
}
