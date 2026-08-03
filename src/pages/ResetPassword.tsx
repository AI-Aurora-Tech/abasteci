import { useState } from 'react'
import { useStore } from '../store'

export default function ResetPassword() {
  const { updatePassword, signOut } = useStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
    // ao concluir, o estado "recovery" é limpo no store e o app segue para o painel
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="brand" style={{ justifyContent: 'center', paddingBottom: 8 }}>
          <span className="dot">⛽</span>
          <span>abasteci</span>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>Defina uma nova senha</p>

        <form onSubmit={submit}>
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {error && <div className="auth-msg error">{error}</div>}
          {done && <div className="auth-msg info">Senha atualizada! Entrando…</div>}

          <button type="submit" className="btn primary block" style={{ marginTop: 6 }} disabled={busy || done}>
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
          <button className="link-btn" onClick={() => void signOut()} type="button">
            Cancelar e sair
          </button>
        </div>
      </div>
    </div>
  )
}
