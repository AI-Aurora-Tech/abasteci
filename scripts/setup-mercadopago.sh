#!/usr/bin/env bash
# Configura os segredos e publica as Edge Functions da assinatura.
# Pre-requisitos:
#   - Supabase CLI:  npm install -g supabase
#   - Login:         supabase login
#   - Arquivo:       supabase/functions/.env.secrets  (a partir do .example)
set -euo pipefail

REF="anigjrfbsdtcjsdqukhl"
SECRETS="supabase/functions/.env.secrets"

if [ ! -f "$SECRETS" ]; then
  echo "Crie o arquivo $SECRETS a partir de .env.secrets.example e preencha os valores." >&2
  exit 1
fi

supabase link --project-ref "$REF"
supabase secrets set --env-file "$SECRETS"
supabase functions deploy subscribe
supabase functions deploy mp-webhook --no-verify-jwt

cat <<EOF

Funcoes publicadas e segredos configurados!
Proximos passos:
  1) No Mercado Pago (Developers > Webhooks), cadastre a URL:
     https://$REF.supabase.co/functions/v1/mp-webhook   (evento: Assinaturas)
  2) No .env do app, defina VITE_BILLING_ENABLED=true e rode 'npm run build'.
EOF
