import { useState } from 'react'
import { Modal } from './ui'
import { useInstall } from '../pwa'

const DISMISS_KEY = 'abasteci:installDismissed:v1'

export function InstallBanner() {
  const { canInstall, installed, ios, promptInstall } = useInstall()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [iosOpen, setIosOpen] = useState(false)

  if (installed || dismissed) return null
  if (!canInstall && !ios) return null

  function close() {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  return (
    <div className="install-banner">
      <span className="ib-icon">⛽</span>
      <div className="ib-text">
        <strong>Instalar o abasteci</strong>
        <span>Ícone na tela inicial, em tela cheia.</span>
      </div>
      {ios ? (
        <button className="btn primary sm" onClick={() => setIosOpen(true)}>
          Como instalar
        </button>
      ) : (
        <button className="btn primary sm" onClick={() => void promptInstall()}>
          Instalar
        </button>
      )}
      <button className="ib-close" onClick={close} aria-label="Dispensar">
        ✕
      </button>
      {iosOpen && <IosInstallModal onClose={() => setIosOpen(false)} />}
    </div>
  )
}

export function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Instalar no iPhone" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        No Safari, adicione o abasteci à tela de início:
      </p>
      <ol style={{ paddingLeft: 20, fontSize: 15, lineHeight: 1.9 }}>
        <li>
          Toque no botão <strong>Compartilhar</strong> <span style={{ fontSize: 18 }}>􀈂</span> (o quadrado com a
          seta para cima), na barra do Safari.
        </li>
        <li>
          Role e toque em <strong>Adicionar à Tela de Início</strong>.
        </li>
        <li>
          Confirme em <strong>Adicionar</strong>. Pronto — o ícone aparece como um app. 🎉
        </li>
      </ol>
      <button className="btn primary block" onClick={onClose} style={{ marginTop: 8 }}>
        Entendi
      </button>
    </Modal>
  )
}
