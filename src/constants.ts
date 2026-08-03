import type { PaymentMethod, RidePlatform } from './types'

export const PLATFORMS: RidePlatform[] = ['Uber', '99', 'InDrive', 'iFood', 'Rappi', 'Particular', 'Outro']

export const PLATFORM_ICON: Record<RidePlatform, string> = {
  Uber: '🚗',
  '99': '🟡',
  InDrive: '🟢',
  iFood: '🛵',
  Rappi: '🧡',
  Particular: '🤝',
  Outro: '💼',
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Dinheiro',
  'PIX',
  'Cartão de crédito',
  'Cartão de débito',
  'Vale-combustível',
  'Outro',
]

export const PAYMENT_ICON: Record<PaymentMethod, string> = {
  Dinheiro: '💵',
  PIX: '⚡',
  'Cartão de crédito': '💳',
  'Cartão de débito': '💳',
  'Vale-combustível': '🎫',
  Outro: '💰',
}
