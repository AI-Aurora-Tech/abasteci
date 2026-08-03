# Configura os segredos e publica as Edge Functions da assinatura.
# Pre-requisitos:
#   - Node.js e Supabase CLI:  npm install -g supabase
#   - Login:                    supabase login
#   - Arquivo preenchido:       supabase/functions/.env.secrets
$ErrorActionPreference = "Stop"

$ref = "anigjrfbsdtcjsdqukhl"
$secrets = "supabase/functions/.env.secrets"

if (-not (Test-Path $secrets)) {
  throw "Crie o arquivo $secrets a partir de .env.secrets.example e preencha os valores."
}

supabase link --project-ref $ref
supabase secrets set --env-file $secrets
supabase functions deploy subscribe
supabase functions deploy mp-webhook --no-verify-jwt

Write-Host ""
Write-Host "Funcoes publicadas e segredos configurados!" -ForegroundColor Green
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1) No Mercado Pago (Developers > Webhooks), cadastre a URL:"
Write-Host "     https://$ref.supabase.co/functions/v1/mp-webhook   (evento: Assinaturas)"
Write-Host "  2) No .env do app, defina VITE_BILLING_ENABLED=true e rode 'npm run build'."
