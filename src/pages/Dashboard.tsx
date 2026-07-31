import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { BarChart, EmptyState, Kpi, PageHeader } from '../components/ui'
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
  const { data } = useStore()
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

  // Gasto por mês (combustível + despesas + manutenção), últimos 6 meses.
  const allSpend = [
    ...fuelings.map((f) => ({ date: f.date, value: f.total })),
    ...expenses.map((e) => ({ date: e.date, value: e.value })),
    ...maintenances.map((m) => ({ date: m.date, value: m.value })),
  ]
  const byMonth = sumByMonth(allSpend, (x) => x.date, (x) => x.value).slice(-6)

  const upcoming = data.reminders
    .filter((r) => r.vehicleId === vehicle.id && !r.done)
    .map((r) => {
      const dLeft = r.dueDate ? daysUntil(r.dueDate) : null
      const kmLeft = r.dueOdometer ? r.dueOdometer - odo : null
      return { ...r, dLeft, kmLeft }
    })
    .sort((a, b) => (a.dLeft ?? 9999) - (b.dLeft ?? 9999))
    .slice(0, 4)

  const recent = [
    ...fuelings.map((f) => ({ date: f.date, kind: '⛽ Abastecimento', desc: `${num(f.liters)} L`, value: f.total })),
    ...expenses.map((e) => ({ date: e.date, kind: `💸 ${e.category}`, desc: e.description, value: e.value })),
    ...maintenances.map((m) => ({ date: m.date, kind: `🔧 ${m.type}`, desc: m.service, value: m.value })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`}
        action={
          <Link to="/abastecimentos" className="btn primary">
            ⛽ Novo abastecimento
          </Link>
        }
      />

      <div className="grid kpi-grid">
        <Kpi
          label="Consumo médio"
          icon="📉"
          value={avg ? `${num(avg)} km/l` : '—'}
          hint={last ? `Última medição: ${num(last)} km/l` : 'Registre 2 tanques cheios'}
        />
        <Kpi
          label="Custo por km"
          icon="🧮"
          value={cpk ? brl(cpk) : '—'}
          hint="Combustível + despesas + manutenção"
        />
        <Kpi label="Gasto no mês" icon="📅" value={brl(monthTotal)} hint={monthLabel(thisMonth + '-01')} />
        <Kpi label="Hodômetro" icon="🛣️" value={km(odo)} hint={`${fuelings.length} abastecimentos`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', marginTop: 22 }}>
        <div className="card">
          <div className="row-between">
            <strong>Gasto mensal</strong>
            <Link to="/relatorios" className="btn ghost" style={{ fontSize: 13 }}>
              Ver relatórios →
            </Link>
          </div>
          {byMonth.length > 0 ? (
            <BarChart data={byMonth.map((m) => ({ label: monthLabel(m.month + '-01'), value: m.value }))} format={brl} />
          ) : (
            <p className="muted" style={{ padding: '30px 0', textAlign: 'center' }}>
              Sem dados suficientes ainda.
            </p>
          )}
        </div>

        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <strong>Próximos lembretes</strong>
            <Link to="/lembretes" className="btn ghost" style={{ fontSize: 13 }}>
              Ver todos
            </Link>
          </div>
          {upcoming.length === 0 && <p className="muted">Nenhum lembrete pendente. 🎉</p>}
          {upcoming.map((r) => {
            const overdue = (r.dLeft !== null && r.dLeft < 0) || (r.kmLeft !== null && r.kmLeft < 0)
            const soon = !overdue && ((r.dLeft !== null && r.dLeft <= 15) || (r.kmLeft !== null && r.kmLeft <= 500))
            return (
              <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row-between">
                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                  <span className={'badge ' + (overdue ? 'red' : soon ? 'orange' : 'blue')}>
                    {overdue ? 'Vencido' : soon ? 'Em breve' : 'Agendado'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                  {r.dueDate && <>📆 {formatDate(r.dueDate)} </>}
                  {r.dueOdometer && <>🛣️ {km(r.dueOdometer)} </>}
                  {r.kmLeft !== null && r.kmLeft >= 0 && <>· faltam {km(r.kmLeft)}</>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <strong>Atividade recente</strong>
        {recent.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            Nenhum registro ainda.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.kind}</td>
                    <td className="muted">{r.desc}</td>
                    <td className="num">{brl(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
