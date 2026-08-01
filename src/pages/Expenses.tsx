import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { EmptyState, Modal, PageHeader, RecordCard } from '../components/ui'
import type { ExpenseCategory } from '../types'
import { brl, currentOdometer, formatDate, todayISO } from '../utils'

const CATEGORIES: ExpenseCategory[] = [
  'IPVA',
  'Seguro',
  'Multa',
  'Pedágio',
  'Estacionamento',
  'Lavagem',
  'Financiamento',
  'Outro',
]

const CATEGORY_ICON: Record<ExpenseCategory, string> = {
  IPVA: '🏛️',
  Seguro: '🛡️',
  Multa: '🚨',
  Pedágio: '🛣️',
  Estacionamento: '🅿️',
  Lavagem: '🚿',
  Financiamento: '🏦',
  Outro: '📌',
}

export default function Expenses() {
  const { data, removeExpense } = useStore()
  const vehicle = useSelectedVehicle()
  const [open, setOpen] = useState(false)

  const expenses = useMemo(
    () =>
      data.expenses
        .filter((e) => e.vehicleId === vehicle?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.expenses, vehicle?.id],
  )
  const total = expenses.reduce((s, e) => s + e.value, 0)

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Despesas" />
        <EmptyState icon="🚗" title="Cadastre um veículo primeiro" action={<Link to="/veiculos" className="btn primary">Veículos</Link>} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Despesas"
        subtitle={`Total registrado: ${brl(total)}`}
        action={
          <button className="btn primary sm" onClick={() => setOpen(true)}>
            + Despesa
          </button>
        }
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon="💸"
          title="Nenhuma despesa"
          hint="Registre IPVA, seguro, multas, pedágios e outros custos fixos do veículo."
          action={<button className="btn primary" onClick={() => setOpen(true)}>Registrar despesa</button>}
        />
      ) : (
        <div className="card">
          {expenses.map((e) => (
            <RecordCard
              key={e.id}
              icon={CATEGORY_ICON[e.category]}
              title={e.description || e.category}
              subtitle={e.category}
              meta={[formatDate(e.date)]}
              amount={brl(e.value)}
              onDelete={() => removeExpense(e.id)}
            />
          ))}
        </div>
      )}

      {open && <ExpenseForm onClose={() => setOpen(false)} />}
    </>
  )
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { data, addExpense } = useStore()
  const vehicle = useSelectedVehicle()!
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState<ExpenseCategory>('IPVA')
  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')
  const [odometer, setOdometer] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(value.replace(',', '.')) || 0
    if (!v) return
    addExpense({
      vehicleId: vehicle.id,
      date,
      category,
      description: description.trim() || category,
      value: v,
      odometer: odometer ? parseInt(odometer, 10) : undefined,
    })
    onClose()
  }

  return (
    <Modal title="Nova despesa" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Descrição</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: IPVA 2026, parcela 1"
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Valor (R$)</label>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="field">
            <label>Hodômetro (opcional)</label>
            <input
              type="number"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder={String(currentOdometer(data, vehicle))}
            />
          </div>
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
