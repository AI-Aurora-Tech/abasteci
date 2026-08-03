import { useState } from 'react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui'
import { daysUntil, formatDate } from '../utils'

const PRICE = 'R$ 4,99'

export default function Subscription({ gate = false }: { gate?: boolean }) {
  const { subscription, startSubscription, refreshSubscription, signOut, user } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = subscription?.status
  const active = status === 'authorized'
  const trialEnd = subscription?.trialEnd?.slice(0, 10)
  const nextCharge = subscription?.currentPeriodEnd?.slice(0, 10)
  const trialDays = trialEnd ? daysUntil(trialEnd) : null
  const inTrial = active && trialDays !== null && trialDays > 0

  async function subscribe() {
    setError(null)
    setBusy(true)
    try {
      await startSubscription()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar a assinatura. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const card = (
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>⛽</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>abasteci Premium</div>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          <strong style={{ color: 'var(--text)', fontSize: 22 }}>{PRICE}</strong> / mês
        </div>
        <div className="badge green" style={{ marginTop: 8 }}>
          1º mês grátis
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0', fontSize: 14, lineHeight: 1.9 }}>
        <li>✅ Todos os recursos do app</li>
        <li>✅ Veículos, abastecimentos e relatórios ilimitados</li>
        <li>✅ Sincronizado na nuvem (Supabase)</li>
        <li>✅ Cancele quando quiser</li>
      </ul>

      {active ? (
        <div className="auth-msg info" style={{ textAlign: 'center' }}>
          <strong>Assinatura ativa</strong>
          <div style={{ marginTop: 4, fontWeight: 500 }}>
            {inTrial
              ? `Teste grátis — faltam ${trialDays} dia(s)${trialEnd ? ` (até ${formatDate(trialEnd)})` : ''}.`
              : nextCharge
                ? `Próxima cobrança em ${formatDate(nextCharge)}.`
                : 'Obrigado por assinar!'}
          </div>
        </div>
      ) : (
        <>
          {status === 'pending' && (
            <div className="auth-msg info" style={{ textAlign: 'center' }}>
              Cadastro do cartão pendente. Conclua para ativar o mês grátis.
            </div>
          )}
          {(status === 'paused' || status === 'cancelled') && (
            <div className="auth-msg error" style={{ textAlign: 'center' }}>
              Sua assinatura está {status === 'paused' ? 'pausada' : 'cancelada'}. Reative para continuar usando.
            </div>
          )}
          {error && <div className="auth-msg error">{error}</div>}
          <button className="btn primary block" onClick={() => void subscribe()} disabled={busy}>
            {busy ? 'Abrindo pagamento…' : status === 'pending' ? 'Continuar cadastro' : 'Começar 1 mês grátis'}
          </button>
          <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>
            Você informa o cartão no ambiente seguro do <strong>Mercado Pago</strong>. Nada é cobrado nos
            primeiros 30 dias; depois, {PRICE}/mês. Cancele quando quiser.
          </p>
        </>
      )}

      <button
        className="btn ghost block"
        style={{ marginTop: 8 }}
        onClick={() => void refreshSubscription()}
      >
        ↻ Atualizar status
      </button>
    </div>
  )

  if (gate) {
    return (
      <div className="auth-wrap">
        <div style={{ width: '100%', maxWidth: 420 }}>
          {card}
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => void signOut()}>
            🚪 Sair da conta
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Assinatura" subtitle={user?.email ?? undefined} />
      {card}
    </>
  )
}
