import { useEffect, useReducer, useState } from 'react'

// Gerencia a instalação do PWA (Adicionar à Tela de Início) e o estado
// online/offline, expondo hooks para a interface.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mm = window.matchMedia?.('(display-mode: standalone)').matches
  // iOS Safari usa navigator.standalone
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(mm || iosStandalone)
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS se identifica como Mac com toque
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)
  return iOS && !isStandalone()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    emit()
  })
}

export interface InstallState {
  canInstall: boolean
  installed: boolean
  ios: boolean
  promptInstall: () => Promise<void>
}

export function useInstall(): InstallState {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    return () => {
      listeners.delete(force)
    }
  }, [])

  const standalone = isStandalone()
  return {
    canInstall: Boolean(deferredPrompt) && !standalone,
    installed: standalone || installed,
    ios: isIOS(),
    async promptInstall() {
      if (!deferredPrompt) return
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice.catch(() => undefined)
      deferredPrompt = null
      emit()
    },
  }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
