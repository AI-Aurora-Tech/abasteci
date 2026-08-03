import { useState } from 'react'
import { useStore } from '../store'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.6C41.6 36.9 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}

export default function Login() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useStore()
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function reset() {
    setError(null)
    setInfo(null)
  }

  async function google() {
    reset()
    setGoogleBusy(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(translate(error))
      setGoogleBusy(false)
    }
    // em caso de sucesso, o navegador é redirecionado para o Google
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    reset()
    setBusy(true)

    if (mode === 'forgot') {
      const { error } = await resetPassword(email.trim())
      setBusy(false)
      if (error) setError(translate(error))
      else setInfo('Se este e-mail tiver conta, enviamos um link para redefinir a senha. Verifique sua caixa de entrada (e o spam).')
      return
    }

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
          {mode === 'in' && 'Entre para acessar seus veículos'}
          {mode === 'up' && 'Crie sua conta gratuita'}
          {mode === 'forgot' && 'Recuperar acesso à conta'}
        </p>

        {mode !== 'forgot' && (
          <>
            <button className="btn block" onClick={() => void google()} disabled={googleBusy} type="button">
              <GoogleIcon />
              {googleBusy ? 'Abrindo…' : 'Continuar com Google'}
            </button>
            <div className="auth-divider">
              <span>ou</span>
            </div>

            <div className="pill-tabs" style={{ display: 'flex', marginBottom: 16 }}>
              <button className={mode === 'in' ? 'active' : ''} style={{ flex: 1 }} onClick={() => { setMode('in'); reset() }} type="button">
                Entrar
              </button>
              <button className={mode === 'up' ? 'active' : ''} style={{ flex: 1 }} onClick={() => { setMode('up'); reset() }} type="button">
                Criar conta
              </button>
            </div>
          </>
        )}

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

          {mode !== 'forgot' && (
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
          )}

          {error && <div className="auth-msg error">{error}</div>}
          {info && <div className="auth-msg info">{info}</div>}

          <button type="submit" className="btn primary block" style={{ marginTop: 6 }} disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
          {mode === 'in' && (
            <button className="link-btn" onClick={() => { setMode('forgot'); reset() }} type="button">
              Esqueci minha senha
            </button>
          )}
          {mode === 'forgot' && (
            <button className="link-btn" onClick={() => { setMode('in'); reset() }} type="button">
              ← Voltar ao login
            </button>
          )}
        </div>
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
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return 'Login com Google ainda não está habilitado no servidor.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.'
  return msg
}
