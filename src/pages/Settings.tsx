import { useState } from 'react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui'

export default function Settings() {
  const { data, user, loadSample, deleteAllData, refresh } = useStore()
  const [busy, setBusy] = useState<string | null>(null)

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abasteci-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const counts = {
    Veículos: data.vehicles.length,
    Abastecimentos: data.fuelings.length,
    Despesas: data.expenses.length,
    Manutenções: data.maintenances.length,
    Lembretes: data.reminders.length,
  }
  const isEmpty = Object.values(counts).every((n) => n === 0)

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle={user?.email ?? undefined} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <strong>Seus dados (Supabase)</strong>
          <button className="btn ghost" onClick={() => void refresh()} disabled={busy !== null}>
            ↻ Recarregar
          </button>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([k, v]) => (
            <div key={k}>
              <div className="kpi-value" style={{ fontSize: 24 }}>{v}</div>
              <div className="muted" style={{ fontSize: 13 }}>{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Comece rápido</strong>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          {isEmpty
            ? 'Sua conta está vazia. Insira dados de exemplo (um carro e uma moto com histórico) para explorar o app.'
            : 'Exporte um backup dos seus dados em JSON quando quiser.'}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {isEmpty && (
            <button
              className="btn primary"
              disabled={busy !== null}
              onClick={() => withBusy('sample', loadSample)}
            >
              {busy === 'sample' ? 'Inserindo…' : '✨ Popular com dados de exemplo'}
            </button>
          )}
          <button className="btn" onClick={exportData} disabled={isEmpty || busy !== null}>
            ⬇ Exportar JSON
          </button>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <strong style={{ color: 'var(--danger)' }}>Zona de perigo</strong>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          Remove permanentemente todos os seus veículos e registros do banco de dados.
        </p>
        <button
          className="btn danger"
          style={{ border: '1px solid var(--danger)', marginTop: 8 }}
          disabled={isEmpty || busy !== null}
          onClick={() =>
            withBusy('delete', async () => {
              if (confirm('Apagar TODOS os seus dados do Supabase? Esta ação não pode ser desfeita.')) {
                await deleteAllData()
              }
            })
          }
        >
          {busy === 'delete' ? 'Apagando…' : '🗑 Apagar todos os meus dados'}
        </button>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 30, fontSize: 13 }}>
        abasteci · gestão de veículos · React + Vite + Supabase
      </p>
    </>
  )
}
