import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectedVehicle, useStore } from '../store'
import { EmptyState, Modal, PageHeader } from '../components/ui'
import type { ReminderBasis } from '../types'
import { currentOdometer, daysUntil, formatDate, km } from '../utils'

export default function Reminders() {
  const { data, toggleReminder, removeReminder } = useStore()
  const vehicle = useSelectedVehicle()
  const [open, setOpen] = useState(false)

  const odo = vehicle ? currentOdometer(data, vehicle) : 0

  const reminders = useMemo(
    () =>
      data.reminders
        .filter((r) => r.vehicleId === vehicle?.id)
        .map((r) => {
          const dLeft = r.dueDate ? daysUntil(r.dueDate) : null
          const kmLeft = r.dueOdometer ? r.dueOdometer - odo : null
          const overdue = !r.done && ((dLeft !== null && dLeft < 0) || (kmLeft !== null && kmLeft < 0))
          const soon = !r.done && !overdue && ((dLeft !== null && dLeft <= 15) || (kmLeft !== null && kmLeft <= 500))
          return { ...r, dLeft, kmLeft, overdue, soon }
        })
        .sort((a, b) => Number(a.done) - Number(b.done) || (a.dLeft ?? 9999) - (b.dLeft ?? 9999)),
    [data.reminders, vehicle?.id, odo],
  )

  if (!vehicle) {
    return (
      <>
        <PageHeader title="Lembretes" />
        <EmptyState icon="🚗" title="Cadastre um veículo primeiro" action={<Link to="/veiculos" className="btn primary">Veículos</Link>} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Lembretes"
        subtitle="Avisos por data ou quilometragem"
        action={
          <button className="btn primary sm" onClick={() => setOpen(true)}>
            + Lembrete
          </button>
        }
      />

      {reminders.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Nenhum lembrete"
          hint="Crie lembretes para troca de óleo, licenciamento, revisões e nunca mais esqueça um prazo."
          action={<button className="btn primary" onClick={() => setOpen(true)}>Criar lembrete</button>}
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {reminders.map((r) => (
            <div className="card" key={r.id} style={{ opacity: r.done ? 0.55 : 1 }}>
              <div className="row-between">
                <span className={'badge ' + (r.done ? 'green' : r.overdue ? 'red' : r.soon ? 'orange' : 'blue')}>
                  {r.done ? 'Concluído' : r.overdue ? 'Vencido' : r.soon ? 'Em breve' : 'Agendado'}
                </span>
                <button className="btn danger" onClick={() => removeReminder(r.id)} title="Excluir">
                  🗑
                </button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, margin: '10px 0 6px' }}>{r.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {r.dueDate && (
                  <div>
                    📆 {formatDate(r.dueDate)}
                    {r.dLeft !== null && !r.done && (
                      <> · {r.dLeft < 0 ? `${-r.dLeft} dia(s) atrás` : `em ${r.dLeft} dia(s)`}</>
                    )}
                  </div>
                )}
                {r.dueOdometer && (
                  <div>
                    🛣️ {km(r.dueOdometer)}
                    {r.kmLeft !== null && !r.done && (
                      <> · {r.kmLeft < 0 ? `${km(-r.kmLeft)} passados` : `faltam ${km(r.kmLeft)}`}</>
                    )}
                  </div>
                )}
              </div>
              <button
                className="btn"
                style={{ marginTop: 12, width: '100%' }}
                onClick={() => toggleReminder(r.id)}
              >
                {r.done ? '↩ Reabrir' : '✓ Marcar como concluído'}
              </button>
            </div>
          ))}
        </div>
      )}

      {open && <ReminderForm onClose={() => setOpen(false)} />}
    </>
  )
}

function ReminderForm({ onClose }: { onClose: () => void }) {
  const { data, addReminder } = useStore()
  const vehicle = useSelectedVehicle()!
  const [title, setTitle] = useState('')
  const [basis, setBasis] = useState<ReminderBasis>('date')
  const [dueDate, setDueDate] = useState('')
  const [dueOdometer, setDueOdometer] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    addReminder({
      vehicleId: vehicle.id,
      title: title.trim(),
      basis,
      dueDate: basis !== 'odometer' && dueDate ? dueDate : undefined,
      dueOdometer: basis !== 'date' && dueOdometer ? parseInt(dueOdometer, 10) : undefined,
      done: false,
    })
    onClose()
  }

  return (
    <Modal title="Novo lembrete" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Troca de óleo" required />
        </div>
        <div className="field">
          <label>Basear em</label>
          <select value={basis} onChange={(e) => setBasis(e.target.value as ReminderBasis)}>
            <option value="date">Data</option>
            <option value="odometer">Quilometragem</option>
            <option value="both">Data e quilometragem</option>
          </select>
        </div>
        <div className="field-row">
          {basis !== 'odometer' && (
            <div className="field">
              <label>Data limite</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
          {basis !== 'date' && (
            <div className="field">
              <label>Hodômetro alvo (km)</label>
              <input
                type="number"
                value={dueOdometer}
                onChange={(e) => setDueOdometer(e.target.value)}
                placeholder={String(currentOdometer(data, vehicle) + 5000)}
              />
            </div>
          )}
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
