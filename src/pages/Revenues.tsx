import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { EmptyState, Modal, PageHeader, RecordCard } from '../components/ui'
import type { Revenue, RidePlatform } from '../types'
import { PLATFORMS, PLATFORM_ICON } from '../constants'
import { brl, formatDate, todayISO, totalSpent } from '../utils'

export default function Revenues() {
  const { data, removeRevenue } = useStore()
  const vehicle = useSelectedVehicle()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Revenue | null>(null)

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (r: Revenue) => {
    setEditing(r)
    setOpen(true)
  }
  const confirmDelete = (r: Revenue) => {
    if (confirm(`Excluir a receita ${r.platform} (${brl(r.value)})?`)) void removeRevenue(r.id)
  }

  const revenues = useMemo(
    () =>
      data.revenues
        .filter((r) => r.vehicleId === vehicle?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.revenues, vehicle?.id],
  )

  const summary = useMemo(() => {
    const income = revenues.reduce((s, r) => s + r.value, 0)
    const costs = vehicle ? totalSpent(data, vehicle.id) : 0
    const profit = income - costs
    const trips = revenues.reduce((s, r) => s + (r.trips ?? 0), 0)
    return { income, costs, profit, trips }
  }, [revenues, data, vehicle])

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Receitas" />
        <EmptyState icon="🚗" title="Cadastre um veículo primeiro" action={<Link to="/veiculos" className="btn primary">Veículos</Link>} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Receitas"
        subtitle="Ganhos como motorista de aplicativo"
        action={
          <button className="btn primary sm" onClick={openNew}>
            + Receita
          </button>
        }
      />

      {/* Resumo — lucro real */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <span style={{ fontWeight: 700 }}>Lucro real</span>
          <span className="muted" style={{ fontSize: 12 }}>{vehicle.name}</span>
        </div>
        <div
          className="kpi-value"
          style={{ fontSize: 30, color: summary.profit >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 6 }}
        >
          {brl(summary.profit)}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>Ganhos − custos (combustível + despesas + manutenção)</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          <Mini label="Ganhos" value={brl(summary.income)} color="var(--success)" />
          <Mini label="Custos" value={brl(summary.costs)} color="var(--danger)" />
          {summary.trips > 0 && <Mini label="Corridas" value={String(summary.trips)} />}
          {summary.trips > 0 && <Mini label="Ganho/corrida" value={brl(summary.income / summary.trips)} />}
        </div>
      </div>

      {revenues.length === 0 ? (
        <EmptyState
          icon="💚"
          title="Nenhuma receita"
          hint="Registre seus ganhos por dia/plataforma para acompanhar o lucro real."
          action={<button className="btn primary" onClick={openNew}>Registrar receita</button>}
        />
      ) : (
        <div className="card">
          {revenues.map((r) => (
            <RecordCard
              key={r.id}
              icon={PLATFORM_ICON[r.platform]}
              title={r.platform}
              subtitle={r.description || undefined}
              meta={[formatDate(r.date), ...(r.trips ? [`${r.trips} corrida(s)`] : [])]}
              amount={brl(r.value)}
              onEdit={() => openEdit(r)}
              onDelete={() => confirmDelete(r)}
            />
          ))}
        </div>
      )}

      {open && <RevenueForm editing={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function RevenueForm({ editing, onClose }: { editing: Revenue | null; onClose: () => void }) {
  const { addRevenue, updateRevenue } = useStore()
  const vehicle = useSelectedVehicle()!
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [platform, setPlatform] = useState<RidePlatform>(editing?.platform ?? 'Uber')
  const [value, setValue] = useState(editing ? String(editing.value) : '')
  const [trips, setTrips] = useState(editing?.trips ? String(editing.trips) : '')
  const [description, setDescription] = useState(editing?.description ?? '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(value.replace(',', '.')) || 0
    if (!v) return
    const payload = {
      vehicleId: vehicle.id,
      date,
      platform,
      value: v,
      trips: trips ? parseInt(trips, 10) : undefined,
      description: description.trim() || undefined,
    }
    if (editing) void updateRevenue(editing.id, payload)
    else void addRevenue(payload)
    onClose()
  }

  return (
    <Modal title={editing ? 'Editar receita' : 'Nova receita'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Plataforma</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as RidePlatform)}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Valor (R$)</label>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="field">
            <label>Corridas (opcional)</label>
            <input type="number" inputMode="numeric" value={trips} onChange={(e) => setTrips(e.target.value)} placeholder="Ex.: 12" />
          </div>
        </div>
        <div className="field">
          <label>Descrição (opcional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: turno da noite" />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
