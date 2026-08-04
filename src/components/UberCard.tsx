import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { uberConnectUrl, uberDisconnect, uberStatus, uberSync } from '../supabase'
import { formatDate } from '../utils'

export const uberEnabled = import.meta.env.VITE_UBER_ENABLED === 'true'

export function UberCard({ vehicleId }: { vehicleId: string }) {
  const { refresh } = useStore()
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    uberStatus()
      .then((s) => {
        setConnected(s.connected)
        setLastSync(s.lastSync)
      })
      .catch(() => setError('Não foi possível consultar a conexão com a Uber.'))
      .finally(() => setLoading(false))
  }, [])

  async function connect() {
    setError(null)
    setBusy(true)
    try {
      window.location.href = await uberConnectUrl()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao conectar com a Uber.')
      setBusy(false)
    }
  }

  async function sync() {
    setError(null)
    setMsg(null)
    setBusy(true)
    try {
      const { imported } = await uberSync(vehicleId)
      await refresh()
      setLastSync(new Date().toISOString())
      setMsg(imported > 0 ? `${imported} receita(s) importada(s) da Uber.` : 'Nenhuma receita nova encontrada.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao sincronizar os ganhos da Uber.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar sua conta Uber?')) return
    setBusy(true)
    try {
      await uberDisconnect()
      setConnected(false)
      setLastSync(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao desconectar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row-between">
        <span style={{ fontWeight: 800 }}>
          <span className="uber-badge">Uber</span> Integração
        </span>
        {connected && <span className="badge green">Conectada</span>}
      </div>

      {loading ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Carregando…</p>
      ) : connected ? (
        <>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {lastSync ? `Última sincronização: ${formatDate(lastSync.slice(0, 10))}.` : 'Ainda não sincronizado.'} Importa
            seus ganhos como Receitas neste veículo.
          </p>
          {msg && <div className="auth-msg info" style={{ marginTop: 8 }}>{msg}</div>}
          {error && <div className="auth-msg error" style={{ marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn primary sm" onClick={() => void sync()} disabled={busy}>
              {busy ? 'Sincronizando…' : '↻ Sincronizar ganhos'}
            </button>
            <button className="btn sm" onClick={() => void disconnect()} disabled={busy}>
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Conecte sua conta Uber para importar seus ganhos automaticamente e calcular o lucro real.
          </p>
          {error && <div className="auth-msg error" style={{ marginTop: 8 }}>{error}</div>}
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => void connect()} disabled={busy}>
            {busy ? 'Abrindo Uber…' : 'Conectar com Uber'}
          </button>
        </>
      )}
    </div>
  )
}
