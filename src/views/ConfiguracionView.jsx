import { useRef, useState } from 'react'
import Spinner from '../components/Spinner'
import { toast } from '../lib/toast'
import { upsertPerfil, uploadAvatar, changePassword } from '../lib/perfil'
import { checkForUpdate, CURRENT_VERSION } from '../lib/appVersion'

export default function ConfiguracionView({ userEmail, perfil, onPerfilChange, onUpdateInfo }) {
  const fileRef = useRef(null)

  // ---- Perfil (nombre + foto) ----
  const [displayName, setDisplayName] = useState(perfil?.display_name || '')
  const [avatarPreview, setAvatarPreview] = useState(perfil?.avatar_url || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [savingPerfil, setSavingPerfil] = useState(false)

  function pickAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function savePerfil() {
    setSavingPerfil(true)
    try {
      let avatar_url = perfil?.avatar_url || null
      if (avatarFile) avatar_url = await uploadAvatar(avatarFile)
      const saved = await upsertPerfil({ display_name: displayName.trim() || null, avatar_url })
      onPerfilChange(saved)
      setAvatarFile(null)
      toast.success('Perfil guardado.')
    } catch (e) {
      console.error(e); toast.error('No se pudo guardar el perfil: ' + e.message)
    } finally {
      setSavingPerfil(false)
    }
  }

  // ---- Cuenta (cambiar contraseña) ----
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  async function savePassword() {
    if (pw.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres.')
    if (pw !== pw2) return toast.error('Las contraseñas no coinciden.')
    setSavingPw(true)
    try {
      await changePassword(pw)
      setPw(''); setPw2('')
      toast.success('Contraseña actualizada.')
    } catch (e) {
      console.error(e); toast.error('No se pudo cambiar la contraseña: ' + e.message)
    } finally {
      setSavingPw(false)
    }
  }

  // ---- Actualizaciones ----
  const [checking, setChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState(null)

  async function checkNow() {
    setChecking(true)
    try {
      const info = await checkForUpdate()
      setLastCheck(info)
      onUpdateInfo(info)
      if (!info) toast.error('No se pudo consultar la versión (¿sin internet?).')
    } finally {
      setChecking(false)
    }
  }

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'MM'

  return (
    <>
      <div className="step"><span className="n">⚙</span><h2>Configuración</h2><span className="sub">· cuenta, perfil y actualizaciones</span></div>

      {/* Perfil */}
      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title"><h2>Perfil</h2></div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="avatar-lg" />
            ) : (
              <span className="avatar-lg avatar-lg-fallback">{initials}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Nombre para mostrar</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: María Morales" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
            <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()}>
              Cambiar foto
            </button>
          </div>
        </div>
        <button className="btn btn-primary" type="button" onClick={savePerfil} disabled={savingPerfil} style={{ marginTop: 16 }}>
          {savingPerfil ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </div>

      {/* Cuenta */}
      <div className="glass" style={{ marginBottom: 16 }}>
        <div className="section-title"><h2>Cuenta</h2></div>
        <p className="muted" style={{ marginTop: 0 }}>Correo: <b>{userEmail}</b></p>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Nueva contraseña</label>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••" autoComplete="new-password" />
        </div>
        <div className="field">
          <label>Repite la contraseña</label>
          <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
            placeholder="••••••••" autoComplete="new-password" />
        </div>
        <button className="btn btn-primary" type="button" onClick={savePassword} disabled={savingPw} style={{ marginTop: 16 }}>
          {savingPw ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </div>

      {/* Actualizaciones */}
      <div className="glass">
        <div className="section-title"><h2>Actualizaciones</h2></div>
        <p className="muted" style={{ marginTop: 0 }}>Versión instalada: <b>v{CURRENT_VERSION}</b></p>

        <button className="btn btn-ghost" type="button" onClick={checkNow} disabled={checking}>
          {checking ? <span className="loader-row"><Spinner /> Buscando…</span> : 'Buscar actualización ahora'}
        </button>

        {lastCheck && (
          lastCheck.updateAvailable ? (
            <div className="banner warn" style={{ marginTop: 14 }}>
              Hay una nueva versión disponible: <b>v{lastCheck.latest}</b>.
              {lastCheck.downloadUrl && (
                <> {' '}<a href={lastCheck.downloadUrl} target="_blank" rel="noreferrer">Descargar</a></>
              )}
            </div>
          ) : (
            <div className="banner good" style={{ marginTop: 14 }}>Ya tienes la última versión.</div>
          )
        )}
      </div>
    </>
  )
}
