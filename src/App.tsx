import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import { configError } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Fuel from './pages/Fuel'
import Expenses from './pages/Expenses'
import Maintenance from './pages/Maintenance'
import Reminders from './pages/Reminders'
import Reports from './pages/Reports'
import Vehicles from './pages/Vehicles'
import Settings from './pages/Settings'
import Mais from './pages/Mais'

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="brand" style={{ fontSize: 26 }}>
        <span className="dot">⛽</span> abasteci
      </div>
      <div className="muted">{children}</div>
    </div>
  )
}

function ConfigError({ message }: { message?: string }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center' }}>
          <span className="dot">⛽</span> abasteci
        </div>
        <h3 style={{ marginTop: 8 }}>{message ? 'Credenciais inválidas' : 'Supabase não configurado'}</h3>
        {message ? (
          <div className="auth-msg error" style={{ textAlign: 'left' }}>
            {message}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            Defina as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em um arquivo{' '}
            <code>.env</code> na raiz do projeto e reinicie o servidor.
          </p>
        )}
        <p className="muted" style={{ fontSize: 13 }}>
          Após ajustar o <code>.env</code>, pare (Ctrl+C) e rode <code>npm run dev</code> novamente. Veja o{' '}
          <code>README.md</code> para o passo a passo.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { configured, sessionLoading, session, dataLoading } = useStore()

  if (!configured) return <ConfigError />
  if (configError) return <ConfigError message={configError} />
  if (sessionLoading) return <Splash>Carregando…</Splash>
  if (!session) return <Login />
  if (dataLoading) return <Splash>Carregando seus dados…</Splash>

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="abastecimentos" element={<Fuel />} />
        <Route path="despesas" element={<Expenses />} />
        <Route path="manutencoes" element={<Maintenance />} />
        <Route path="lembretes" element={<Reminders />} />
        <Route path="relatorios" element={<Reports />} />
        <Route path="veiculos" element={<Vehicles />} />
        <Route path="mais" element={<Mais />} />
        <Route path="config" element={<Settings />} />
      </Route>
    </Routes>
  )
}
