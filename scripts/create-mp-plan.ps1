# Cria o plano de assinatura no Mercado Pago (R$ 4,99/mes + 1 mes gratis).
# Uso:  ./scripts/create-mp-plan.ps1 -Token "APP_USR-..." -AppUrl "https://seu-app"
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$AppUrl = "https://SEU-APP"
)

$body = @{
  reason         = "abasteci Premium"
  auto_recurring = @{
    frequency          = 1
    frequency_type     = "months"
    transaction_amount = 4.99
    currency_id        = "BRL"
    free_trial         = @{ frequency = 1; frequency_type = "months" }
  }
  back_url                = $AppUrl
  payment_methods_allowed = @{ payment_types = @(@{ id = "credit_card" }) }
} | ConvertTo-Json -Depth 6

try {
  $resp = Invoke-RestMethod -Method Post -Uri "https://api.mercadopago.com/preapproval_plan" `
    -Headers @{ Authorization = "Bearer $Token" } -ContentType "application/json" -Body $body
  Write-Host "Plano criado com sucesso!" -ForegroundColor Green
  Write-Host "MP_PREAPPROVAL_PLAN_ID = $($resp.id)" -ForegroundColor Cyan
} catch {
  Write-Host "Falha ao criar o plano:" -ForegroundColor Red
  Write-Host $_.Exception.Message
}
