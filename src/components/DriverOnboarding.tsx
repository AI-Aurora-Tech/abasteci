import { useState } from 'react'
import { useStore } from '../store'
import { Modal } from './ui'

/**
 * Pergunta uma única vez (quando ainda não sabemos) se o usuário é motorista
 * de aplicativo. Cobre também quem entrou pelo Google (sem o checkbox do
 * cadastro). A resposta fica salva no perfil (user_metadata.is_driver).
 */
export function DriverOnboarding() {
  const { driverKnown, setDriver } = useStore()
  const [busy, setBusy] = useState(false)
  const [answered, setAnswered] = useState(false)

  if (driverKnown || answered) return null

  async function answer(value: boolean) {
    setBusy(true)
    await setDriver(value)
    setAnswered(true)
    setBusy(false)
  }

  return (
    <Modal title="Bem-vindo(a) ao abasteci! ⛽" onClose={() => void answer(false)}>
      <p style={{ marginTop: 0, fontSize: 15 }}>Você é motorista de aplicativo (Uber, 99, iFood…)?</p>
      <p className="muted" style={{ fontSize: 13 }}>
        Se sim, ativamos o módulo de <strong>Receitas</strong> para você registrar seus ganhos e acompanhar o{' '}
        <strong>lucro real</strong> (ganhos − custos).
      </p>
      <div className="modal-foot">
        <button className="btn" onClick={() => void answer(false)} disabled={busy}>
          Não
        </button>
        <button className="btn primary" onClick={() => void answer(true)} disabled={busy}>
          Sim, sou motorista
        </button>
      </div>
    </Modal>
  )
}
