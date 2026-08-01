import { useState } from 'react'
import { useStore } from '../store'
import { EmptyState, Modal, PageHeader } from '../components/ui'
import type { FuelType, Vehicle } from '../types'
import { brl, currentOdometer, km, totalSpent } from '../utils'

const FUEL_TYPES: FuelType[] = [
  'Gasolina',
  'Gasolina Aditivada',
  'Etanol',
  'Diesel',
  'Diesel S10',
  'GNV',
  'Elétrico',
]

const COLORS = ['#0ea5e9', '#f97316', '#8b5cf6', '#16a34a', '#dc2626', '#eab308', '#ec4899', '#14b8a6']

export default function Vehicles() {
  const { data, removeVehicle, setSelectedVehicleId, selectedVehicleId } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle={`${data.vehicles.length} veículo(s) cadastrado(s)`}
        action={
          <button
            className="btn primary sm"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            + Veículo
          </button>
        }
      />

      {data.vehicles.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="Nenhum veículo"
          hint="Cadastre um carro, moto ou qualquer veículo para começar a controlar seus custos."
          action={<button className="btn primary" onClick={() => setOpen(true)}>Cadastrar veículo</button>}
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {data.vehicles.map((v) => {
            const active = v.id === selectedVehicleId
            return (
              <div
                className="card"
                key={v.id}
                style={{ borderColor: active ? v.color : 'var(--border)', borderWidth: active ? 2 : 1 }}
              >
                <div className="row-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="swatch" style={{ background: v.color, width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{v.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {v.make} {v.model} {v.year ? `· ${v.year}` : ''}
                      </div>
                    </div>
                  </div>
                  {active && <span className="badge blue">Ativo</span>}
                </div>

                <div style={{ display: 'flex', gap: 18, margin: '16px 0', flexWrap: 'wrap' }}>
                  <Stat label="Placa" value={v.plate} />
                  <Stat label="Combustível" value={v.fuelType} />
                  <Stat label="Hodômetro" value={km(currentOdometer(data, v))} />
                  <Stat label="Gasto total" value={brl(totalSpent(data, v.id))} />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {!active && (
                    <button className="btn" onClick={() => setSelectedVehicleId(v.id)}>
                      Selecionar
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={() => {
                      setEditing(v)
                      setOpen(true)
                    }}
                  >
                    ✎ Editar
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      if (confirm(`Excluir "${v.name}" e todos os seus registros?`)) removeVehicle(v.id)
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && <VehicleForm vehicle={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function VehicleForm({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const { addVehicle, updateVehicle } = useStore()
  const [name, setName] = useState(vehicle?.name ?? '')
  const [plate, setPlate] = useState(vehicle?.plate ?? '')
  const [make, setMake] = useState(vehicle?.make ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '')
  const [fuelType, setFuelType] = useState<FuelType>(vehicle?.fuelType ?? 'Gasolina')
  const [odometer, setOdometer] = useState(vehicle ? String(vehicle.odometer) : '0')
  const [color, setColor] = useState(vehicle?.color ?? COLORS[0])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      plate: plate.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year, 10) : null,
      fuelType,
      odometer: parseInt(odometer, 10) || 0,
      color,
    }
    if (vehicle) updateVehicle(vehicle.id, payload)
    else addVehicle(payload)
    onClose()
  }

  return (
    <Modal title={vehicle ? 'Editar veículo' : 'Novo veículo'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Apelido</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Meu carro" required />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Marca</label>
            <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Ex.: Chevrolet" />
          </div>
          <div className="field">
            <label>Modelo</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex.: Onix" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Placa</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1D23" />
          </div>
          <div className="field">
            <label>Ano</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2021" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Combustível principal</label>
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Hodômetro atual (km)</label>
            <input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Cor de identificação</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '3px solid var(--text)' : '2px solid var(--border)',
                  cursor: 'pointer',
                }}
                aria-label={`Cor ${c}`}
              />
            ))}
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
