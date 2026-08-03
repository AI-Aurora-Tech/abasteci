import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { EmptyState, Modal, PageHeader, PaymentField, RecordCard } from '../components/ui'
import type { Maintenance as MaintenanceEntry, MaintenanceType, PaymentMethod } from '../types'
import { PAYMENT_ICON } from '../constants'
import { brl, currentOdometer, formatDate, km, todayISO } from '../utils'

export default function Maintenance() {
  const { data, removeMaintenance } = useStore()
  const vehicle = useSelectedVehicle()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceEntry | null>(null)

  const openNew = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (m: MaintenanceEntry) => {
    setEditing(m)
    setOpen(true)
  }
  const confirmDelete = (m: MaintenanceEntry) => {
    if (confirm(`Excluir a manutenção "${m.service}" (${brl(m.value)})?`)) {
      void removeMaintenance(m.id)
    }
  }

  const items = useMemo(
    () =>
      data.maintenances
        .filter((m) => m.vehicleId === vehicle?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.maintenances, vehicle?.id],
  )
  const total = items.reduce((s, m) => s + m.value, 0)

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Manutenções" />
        <EmptyState icon="🚗" title="Cadastre um veículo primeiro" action={<Link to="/veiculos" className="btn primary">Veículos</Link>} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Manutenções"
        subtitle={`Total registrado: ${brl(total)}`}
        action={
          <button className="btn primary sm" onClick={openNew}>
            + Manutenção
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon="🔧"
          title="Nenhuma manutenção"
          hint="Registre trocas de óleo, revisões e reparos, preventivos ou corretivos."
          action={<button className="btn primary" onClick={openNew}>Registrar manutenção</button>}
        />
      ) : (
        <div className="card">
          {items.map((m) => (
            <RecordCard
              key={m.id}
              icon="🔧"
              title={m.service}
              subtitle={m.workshop ? `${m.workshop}` : undefined}
              meta={[
                formatDate(m.date),
                km(m.odometer),
                ...(m.paymentMethod ? [`${PAYMENT_ICON[m.paymentMethod]} ${m.paymentMethod}`] : []),
              ]}
              amount={brl(m.value)}
              badge={<span className={'badge ' + (m.type === 'Preventiva' ? 'green' : 'orange')}>{m.type}</span>}
              onEdit={() => openEdit(m)}
              onDelete={() => confirmDelete(m)}
            />
          ))}
        </div>
      )}

      {open && <MaintenanceForm editing={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

function MaintenanceForm({ editing, onClose }: { editing: MaintenanceEntry | null; onClose: () => void }) {
  const { data, addMaintenance, updateMaintenance } = useStore()
  const vehicle = useSelectedVehicle()!
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [type, setType] = useState<MaintenanceType>(editing?.type ?? 'Preventiva')
  const [service, setService] = useState(editing?.service ?? '')
  const [odometer, setOdometer] = useState(String(editing?.odometer ?? (currentOdometer(data, vehicle) || '')))
  const [value, setValue] = useState(editing ? String(editing.value) : '')
  const [workshop, setWorkshop] = useState(editing?.workshop ?? '')
  const [payment, setPayment] = useState<string>(editing?.paymentMethod ?? '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(value.replace(',', '.')) || 0
    if (!service.trim()) return
    const payload = {
      vehicleId: vehicle.id,
      date,
      type,
      service: service.trim(),
      odometer: parseInt(odometer, 10) || vehicle.odometer,
      value: v,
      workshop: workshop.trim() || undefined,
      paymentMethod: (payment || undefined) as PaymentMethod | undefined,
    }
    if (editing) void updateMaintenance(editing.id, payload)
    else void addMaintenance(payload)
    onClose()
  }

  return (
    <Modal title={editing ? 'Editar manutenção' : 'Nova manutenção'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as MaintenanceType)}>
              <option value="Preventiva">Preventiva</option>
              <option value="Corretiva">Corretiva</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Serviço</label>
          <input
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Ex.: Troca de óleo e filtro"
            required
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Hodômetro (km)</label>
            <input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} required />
          </div>
          <div className="field">
            <label>Valor (R$)</label>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        <div className="field">
          <label>Oficina (opcional)</label>
          <input value={workshop} onChange={(e) => setWorkshop(e.target.value)} placeholder="Ex.: Auto Center Silva" />
        </div>
        <PaymentField value={payment} onChange={setPayment} />
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
