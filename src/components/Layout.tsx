import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store'
import { useOnline } from '../pwa'
import { InstallBanner } from './Install'

const tabs = [
  { to: '/', label: 'Painel', icon: '🏠', end: true },
  { to: '/abastecimentos', label: 'Abastecer', icon: '⛽' },
  { to: '/despesas', label: 'Despesas', icon: '💸' },
  { to: '/relatorios', label: 'Relatórios', icon: '📈' },
  { to: '/mais', label: 'Mais', icon: '☰' },
]

function VehiclePicker() {
  const { data, selectedVehicleId, setSelectedVehicleId } = useStore()
  if (data.vehicles.length === 0) return null
  const selected = data.vehicles.find((v) => v.id === selectedVehicleId) ?? data.vehicles[0]
  return (
    <div className="vehicle-select">
      <span className="swatch" style={{ background: selected.color }} />
      <select
        value={selected.id}
        onChange={(e) => setSelectedVehicleId(e.target.value)}
        aria-label="Selecionar veículo"
      >
        {data.vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function ConnBadge() {
  const online = useOnline()
  if (online) return null
  return (
    <span className="conn-badge" title="Sem conexão">
      ● offline
    </span>
  )
}

export default function Layout() {
  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <span className="dot">⛽</span>
          <span>abasteci</span>
          <ConnBadge />
        </div>
        <VehiclePicker />
      </header>

      <main className="content">
        <InstallBanner />
        <Outlet />
      </main>

      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
          >
            <span className="ico">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
