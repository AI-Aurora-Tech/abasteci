import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store'

const nav = [
  { to: '/', label: 'Painel', icon: '📊', end: true },
  { to: '/abastecimentos', label: 'Abastecimentos', icon: '⛽' },
  { to: '/despesas', label: 'Despesas', icon: '💸' },
  { to: '/manutencoes', label: 'Manutenções', icon: '🔧' },
  { to: '/lembretes', label: 'Lembretes', icon: '🔔' },
  { to: '/relatorios', label: 'Relatórios', icon: '📈' },
  { to: '/veiculos', label: 'Veículos', icon: '🚗' },
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
            {v.name} · {v.plate}
          </option>
        ))}
      </select>
    </div>
  )
}

function UserMenu() {
  const { user, signOut } = useStore()
  return (
    <div className="user-menu">
      <span className="user-email" title={user?.email ?? ''}>
        {user?.email}
      </span>
      <button className="btn ghost" onClick={() => void signOut()} title="Sair">
        Sair
      </button>
    </div>
  )
}

export default function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="dot">⛽</span>
          <span>abasteci</span>
        </div>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            <span className="ico">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        <NavLink to="/config" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          <span className="ico">⚙️</span>
          Configurações
        </NavLink>
      </aside>

      <main className="main">
        <div className="main-topbar">
          <UserMenu />
          <VehiclePicker />
        </div>
        <Outlet />
      </main>

      <nav className="mobile-nav">
        {nav.slice(0, 5).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
