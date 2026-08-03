#!/usr/bin/env bash
# Cria o plano de assinatura no Mercado Pago (R$ 4,99/mes + 1 mes gratis).
# Uso:  ./scripts/create-mp-plan.sh <ACCESS_TOKEN> [APP_URL]
set -euo pipefail

TOKEN="${1:?Uso: create-mp-plan.sh <ACCESS_TOKEN> [APP_URL]}"
APP_URL="${2:-https://SEU-APP}"

curl -sS -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "abasteci Premium",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 4.99,
      "currency_id": "BRL",
      "free_trial": { "frequency": 1, "frequency_type": "months" }
    },
    "back_url": "'"${APP_URL}"'",
    "payment_methods_allowed": { "payment_types": [ { "id": "credit_card" } ] }
  }'

echo
echo "Copie o campo \"id\" da resposta acima -> MP_PREAPPROVAL_PLAN_ID"
