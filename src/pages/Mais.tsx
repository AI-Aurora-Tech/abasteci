import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { PageHeader } from '../components/ui'
import { useInstall } from '../pwa'
import { InstallGuideModal } from '../components/Install'

const baseItems = [
  { to: '/manutencoes', icon: '🔧', label: 'Manutenções' },
  { to: '/lembretes', icon: '🔔', label: 'Lembretes' },
  { to: '/veiculos', icon: '🚗', label: 'Veículos' },
  { to: '/config', icon: '⚙️', label: 'Configurações' },
]

export default function Mais() {
  const { user, signOut, billingEnabled, driver } = useStore()
  const { canInstall, ios, installed, promptInstall } = useInstall()
  const [guideOpen, setGuideOpen] = useState(false)
  const items = [
    ...(driver ? [{ to: '/receitas', icon: '💚', label: 'Receitas (motorista)' }] : []),
    ...baseItems,
    ...(billingEnabled ? [{ to: '/assinatura', icon: '⭐', label: 'Assinatura' }] : []),
  ]

  const canQuickInstall = !installed && canInstall && !ios

  return (
    <>
      <PageHeader title="Mais" subtitle={user?.email ?? undefined} />

      {canQuickInstall && (
        <button
          className="btn primary block"
          style={{ marginBottom: 10 }}
          onClick={() => void promptInstall()}
        >
          📲 Instalar aplicativo
        </button>
      )}
      {!installed && (
        <button
          className="btn block"
          style={{ marginBottom: 14 }}
          onClick={() => setGuideOpen(true)}
        >
          📖 Como instalar no Android e iPhone
        </button>
      )}
      {guideOpen && <InstallGuideModal onClose={() => setGuideOpen(false)} />}

      <div className="card" style={{ padding: '4px 16px' }}>
        <div className="menu-list">
          {items.map((it) => (
            <Link key={it.to} to={it.to} className="menu-item">
              <span className="ico">{it.icon}</span>
              {it.label}
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      </div>

      <button
        className="btn block"
        style={{ marginTop: 16 }}
        onClick={() => void signOut()}
      >
        🚪 Sair da conta
      </button>

      <p className="muted" style={{ textAlign: 'center', marginTop: 24, fontSize: 12 }}>
        abasteci · gestão de veículos
      </p>
    </>
  )
}
