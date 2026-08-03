import type { PaymentMethod } from './types'

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
