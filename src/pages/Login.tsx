import { useState } from 'react'
import { useStore } from '../store'

export default function Login() {
  const { signIn, signUp } = useStore()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const fn = mode === 'in' ? signIn : signUp
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError(translate(error))
      return
    }
    if (mode === 'up') {
      setInfo('Conta criada! Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada antes de entrar.')
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="brand" style={{ justifyContent: 'center', paddingBottom: 8 }}>
          <span className="dot">⛽</span>
          <span>abasteci</span>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>
          {mode === 'in' ? 'Entre para acessar seus veículos' : 'Crie sua conta gratuita'}
        </p>

        <div className="pill-tabs" style={{ display: 'flex', margin: '4px 0 18px' }}>
          <button className={mode === 'in' ? 'active' : ''} style={{ flex: 1 }} onClick={() => setMode('in')} type="button">
            Entrar
          </button>
          <button className={mode === 'up' ? 'active' : ''} style={{ flex: 1 }} onClick={() => setMode('up')} type="button">
            Criar conta
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </div>

          {error && <div className="auth-msg error">{error}</div>}
          {info && <div className="auth-msg info">{info}</div>}

          <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
        Seus dados ficam salvos com segurança no Supabase.
      </p>
    </div>
  )
}

function translate(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha inválidos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já está cadastrado.'
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
  if (m.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
  return msg
}
