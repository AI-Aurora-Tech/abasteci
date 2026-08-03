import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { PageHeader } from '../components/ui'
import { useInstall } from '../pwa'
import { IosInstallModal } from '../components/Install'

const baseItems = [
  { to: '/manutencoes', icon: '🔧', label: 'Manutenções' },
  { to: '/lembretes', icon: '🔔', label: 'Lembretes' },
  { to: '/veiculos', icon: '🚗', label: 'Veículos' },
  { to: '/config', icon: '⚙️', label: 'Configurações' },
]

export default function Mais() {
  const { user, signOut, billingEnabled } = useStore()
  const { canInstall, ios, installed, promptInstall } = useInstall()
  const [iosOpen, setIosOpen] = useState(false)
  const items = billingEnabled
    ? [...baseItems, { to: '/assinatura', icon: '⭐', label: 'Assinatura' }]
    : baseItems

  const showInstall = !installed && (canInstall || ios)

  return (
    <>
      <PageHeader title="Mais" subtitle={user?.email ?? undefined} />

      {showInstall && (
        <button
          className="btn primary block"
          style={{ marginBottom: 14 }}
          onClick={() => (ios ? setIosOpen(true) : void promptInstall())}
        >
          📲 Instalar aplicativo
        </button>
      )}
      {iosOpen && <IosInstallModal onClose={() => setIosOpen(false)} />}

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
