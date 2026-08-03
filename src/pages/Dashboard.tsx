import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { BarChart, EmptyState, Kpi, PageHeader, RecordCard } from '../components/ui'
import {
  averageConsumption,
  brl,
  costPerKm,
  currentOdometer,
  daysUntil,
  formatDate,
  km,
  lastConsumption,
  monthLabel,
  num,
  sumByMonth,
  todayISO,
} from '../utils'

export default function Dashboard() {
  const { data, driver } = useStore()
  const vehicle = useSelectedVehicle()

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Painel" subtitle="Visão geral do seu veículo" />
        <EmptyState
          icon="🚗"
          title="Nenhum veículo cadastrado"
          hint="Cadastre seu primeiro veículo para começar a controlar abastecimentos, despesas e manutenções."
          action={
            <Link to="/veiculos" className="btn primary">
              Cadastrar veículo
            </Link>
          }
        />
      </>
    )
  }

  const fuelings = data.fuelings.filter((f) => f.vehicleId === vehicle.id)
  const expenses = data.expenses.filter((e) => e.vehicleId === vehicle.id)
  const maintenances = data.maintenances.filter((m) => m.vehicleId === vehicle.id)

  const avg = averageConsumption(fuelings)
  const last = lastConsumption(fuelings)
  const cpk = costPerKm(data, vehicle)
  const odo = currentOdometer(data, vehicle)

  const thisMonth = todayISO().slice(0, 7)
  const monthTotal =
    fuelings.filter((f) => f.date.slice(0, 7) === thisMonth).reduce((s, f) => s + f.total, 0) +
    expenses.filter((e) => e.date.slice(0, 7) === thisMonth).reduce((s, e) => s + e.value, 0) +
    maintenances.filter((m) => m.date.slice(0, 7) === thisMonth).reduce((s, m) => s + m.value, 0)

  const allSpend = [
    ...fuelings.map((f) => ({ date: f.date, value: f.total })),
    ...expenses.map((e) => ({ date: e.date, value: e.value })),
    ...maintenances.map((m) => ({ date: m.date, value: m.value })),
  ]
  const byMonth = sumByMonth(allSpend, (x) => x.date, (x) => x.value).slice(-6)

  // Motorista de aplicativo: receita e lucro do mês para o veículo.
  const monthRevenue = data.revenues
    .filter((r) => r.vehicleId === vehicle.id && r.date.slice(0, 7) === thisMonth)
    .reduce((s, r) => s + r.value, 0)
  const monthProfit = monthRevenue - monthTotal

  const upcoming = data.reminders
    .filter((r) => r.vehicleId === vehicle.id && !r.done)
    .map((r) => {
      const dLeft = r.dueDate ? daysUntil(r.dueDate) : null
      const kmLeft = r.dueOdometer ? r.dueOdometer - odo : null
      return { ...r, dLeft, kmLeft }
    })
    .sort((a, b) => (a.dLeft ?? 9999) - (b.dLeft ?? 9999))
    .slice(0, 3)

  const recent = [
    ...fuelings.map((f) => ({ date: f.date, icon: '⛽', label: 'Abastecimento', desc: `${num(f.liters)} L`, value: f.total })),
    ...expenses.map((e) => ({ date: e.date, icon: '💸', label: e.category, desc: e.description, value: e.value })),
    ...maintenances.map((m) => ({ date: m.date, icon: '🔧', label: m.type, desc: m.service, value: m.value })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`}
        action={
          <Link to="/abastecimentos" className="btn primary sm">
            ⛽ Abastecer
          </Link>
        }
      />

      <div className="grid kpi-grid">
        <Kpi
          label="Consumo médio"
          icon="📉"
          value={avg ? `${num(avg)} km/l` : '—'}
          hint={last ? `Última: ${num(last)} km/l` : 'Registre 2 tanques cheios'}
        />
        <Kpi label="Custo por km" icon="🧮" value={cpk ? brl(cpk) : '—'} hint="Tudo incluído" />
        <Kpi label="Gasto no mês" icon="📅" value={brl(monthTotal)} hint={monthLabel(thisMonth + '-01')} />
        <Kpi label="Hodômetro" icon="🛣️" value={km(odo)} hint={`${fuelings.length} abast.`} />
      </div>

      {driver && (
        <>
          <div className="section-title">Motorista — lucro do mês</div>
          <Link to="/receitas" className="card" style={{ display: 'block' }}>
            <div className="row-between">
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Lucro em {monthLabel(thisMonth + '-01')}</div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: monthProfit >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {brl(monthProfit)}
                </div>
              </div>
              <span className="btn ghost sm">Ver receitas →</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Ganhos {brl(monthRevenue)} · Custos {brl(monthTotal)}
            </div>
          </Link>
        </>
      )}

      <div className="section-title">Gasto mensal</div>
      <div className="card">
        {byMonth.length > 0 ? (
          <BarChart data={byMonth.map((m) => ({ label: monthLabel(m.month + '-01'), value: m.value }))} format={brl} />
        ) : (
          <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            Sem dados suficientes ainda.
          </p>
        )}
      </div>

      <div className="row-between" style={{ margin: '22px 0 10px' }}>
        <span className="section-title" style={{ margin: 0 }}>
          Próximos lembretes
        </span>
        <Link to="/lembretes" className="btn ghost sm">
          Ver todos
        </Link>
      </div>
      <div className="card">
        {upcoming.length === 0 && <p className="muted">Nenhum lembrete pendente. 🎉</p>}
        {upcoming.map((r) => {
          const overdue = (r.dLeft !== null && r.dLeft < 0) || (r.kmLeft !== null && r.kmLeft < 0)
          const soon = !overdue && ((r.dLeft !== null && r.dLeft <= 15) || (r.kmLeft !== null && r.kmLeft <= 500))
          return (
            <RecordCard
              key={r.id}
              icon="🔔"
              title={r.title}
              subtitle={
                <>
                  {r.dueDate && <>📆 {formatDate(r.dueDate)} </>}
                  {r.dueOdometer && <>🛣️ {km(r.dueOdometer)}</>}
                </>
              }
              badge={
                <span className={'badge ' + (overdue ? 'red' : soon ? 'orange' : 'blue')}>
                  {overdue ? 'Vencido' : soon ? 'Em breve' : 'Agendado'}
                </span>
              }
            />
          )
        })}
      </div>

      <div className="section-title">Atividade recente</div>
      <div className="card">
        {recent.length === 0 ? (
          <p className="muted">Nenhum registro ainda.</p>
        ) : (
          recent.map((r, i) => (
            <RecordCard
              key={i}
              icon={r.icon}
              title={r.desc || r.label}
              subtitle={r.label}
              meta={[formatDate(r.date)]}
              amount={brl(r.value)}
            />
          ))
        )}
      </div>
    </>
  )
}
