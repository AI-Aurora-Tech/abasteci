import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { BarChart, EmptyState, Kpi, PageHeader } from '../components/ui'
import {
  averageConsumption,
  brl,
  costPerKm,
  currentOdometer,
  monthLabel,
  num,
  sumByMonth,
} from '../utils'

type Range = 6 | 12 | 0 // 0 = tudo

export default function Reports() {
  const { data } = useStore()
  const vehicle = useSelectedVehicle()
  const [range, setRange] = useState<Range>(6)

  const report = useMemo(() => {
    if (!vehicle) return null
    const fuelings = data.fuelings.filter((f) => f.vehicleId === vehicle.id)
    const expenses = data.expenses.filter((e) => e.vehicleId === vehicle.id)
    const maintenances = data.maintenances.filter((m) => m.vehicleId === vehicle.id)

    const fuelByMonth = sumByMonth(fuelings, (f) => f.date, (f) => f.total)
    const expByMonth = sumByMonth(expenses, (e) => e.date, (e) => e.value)
    const maintByMonth = sumByMonth(maintenances, (m) => m.date, (m) => m.value)

    const months = [...new Set([...fuelByMonth, ...expByMonth, ...maintByMonth].map((x) => x.month))].sort()
    const sliced = range === 0 ? months : months.slice(-range)

    const combined = sliced.map((month) => {
      const fuel = fuelByMonth.find((x) => x.month === month)?.value ?? 0
      const exp = expByMonth.find((x) => x.month === month)?.value ?? 0
      const maint = maintByMonth.find((x) => x.month === month)?.value ?? 0
      return { month, fuel, exp, maint, total: fuel + exp + maint }
    })

    const totalFuel = fuelings.reduce((s, f) => s + f.total, 0)
    const totalExp = expenses.reduce((s, e) => s + e.value, 0)
    const totalMaint = maintenances.reduce((s, m) => s + m.value, 0)
    const grandTotal = totalFuel + totalExp + totalMaint

    // Preço médio do litro ponderado por litros.
    const litersTotal = fuelings.reduce((s, f) => s + f.liters, 0)
    const avgPrice = litersTotal > 0 ? totalFuel / litersTotal : 0

    return {
      combined,
      totalFuel,
      totalExp,
      totalMaint,
      grandTotal,
      avgPrice,
      litersTotal,
      avg: averageConsumption(fuelings),
      cpk: costPerKm(data, vehicle),
      odo: currentOdometer(data, vehicle),
      count: fuelings.length + expenses.length + maintenances.length,
    }
  }, [data, vehicle, range])

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Relatórios" />
        <EmptyState icon="🚗" title="Cadastre um veículo primeiro" action={<Link to="/veiculos" className="btn primary">Veículos</Link>} />
      </>
    )
  }

  const r = report!
  const share = (v: number) => (r.grandTotal > 0 ? Math.round((v / r.grandTotal) * 100) : 0)

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`${vehicle.make} ${vehicle.model}`} />

      <div className="pill-tabs" style={{ marginBottom: 16 }}>
        {([6, 12, 0] as Range[]).map((rg) => (
          <button key={rg} className={range === rg ? 'active' : ''} onClick={() => setRange(rg)}>
            {rg === 0 ? 'Tudo' : `${rg} meses`}
          </button>
        ))}
      </div>

      {r.count === 0 ? (
        <EmptyState icon="📈" title="Sem dados para relatórios" hint="Adicione abastecimentos e despesas para gerar gráficos." />
      ) : (
        <>
          <div className="grid kpi-grid">
            <Kpi label="Gasto total" icon="💰" value={brl(r.grandTotal)} hint="Todo o período" />
            <Kpi label="Consumo médio" icon="📉" value={r.avg ? `${num(r.avg)} km/l` : '—'} />
            <Kpi label="Custo por km" icon="🧮" value={r.cpk ? brl(r.cpk) : '—'} />
            <Kpi
              label="Preço médio do litro"
              icon="⛽"
              value={r.avgPrice ? brl(r.avgPrice) : '—'}
              hint={`${num(r.litersTotal)} L abastecidos`}
            />
          </div>

          <div className="section-title">Gasto mensal por categoria</div>
          <div className="card">
            <BarChart
              data={r.combined.map((c) => ({ label: monthLabel(c.month + '-01'), value: c.total }))}
              format={brl}
            />
            <div className="legend">
              <span><span className="swatch" style={{ background: 'var(--primary)' }} /> Total mensal (combustível + despesas + manutenção)</span>
            </div>
          </div>

          <div className="section-title">Composição dos gastos</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <CategoryCard label="⛽ Combustível" value={r.totalFuel} pct={share(r.totalFuel)} color="var(--primary)" />
            <CategoryCard label="💸 Despesas" value={r.totalExp} pct={share(r.totalExp)} color="#8b5cf6" />
            <CategoryCard label="🔧 Manutenção" value={r.totalMaint} pct={share(r.totalMaint)} color="#f97316" />
          </div>

          <div className="section-title">Detalhamento mensal</div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Combustível</th>
                  <th className="num">Despesas</th>
                  <th className="num">Manutenção</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...r.combined].reverse().map((c) => (
                  <tr key={c.month}>
                    <td>{monthLabel(c.month + '-01')}</td>
                    <td className="num">{brl(c.fuel)}</td>
                    <td className="num">{brl(c.exp)}</td>
                    <td className="num">{brl(c.maint)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{brl(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function CategoryCard({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="card">
      <div className="row-between">
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span className="badge">{pct}%</span>
      </div>
      <div className="kpi-value" style={{ fontSize: 22, marginTop: 8 }}>{brl(value)}</div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}
