# Assinatura (Mercado Pago) — configuração

O app cobra **R$ 4,99/mês** com **1 mês grátis**, cartão informado no cadastro e
cobrança recorrente automática depois. O fluxo usa **duas Edge Functions**
(`subscribe` e `mp-webhook`) e a tabela `subscriptions`.

> Enquanto não terminar esta configuração, mantenha `VITE_BILLING_ENABLED=false`
> no `.env` — o app funciona normalmente, sem o paywall.

## 1. Banco de dados

No **SQL Editor** do Supabase, rode
[`supabase/migrations/0004_subscriptions.sql`](../migrations/0004_subscriptions.sql).

## 2. Conta e plano no Mercado Pago

1. Tenha uma conta em [mercadopago.com.br](https://www.mercadopago.com.br) com **Assinaturas** habilitadas.
2. Em **Seu negócio → Configurações → Credenciais** (ou *Developers*), copie o **Access Token** de **produção**.
3. Crie o **plano de assinatura** com teste grátis. Pelo terminal:

   ```bash
   curl -X POST https://api.mercadopago.com/preapproval_plan \
     -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
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
       "back_url": "https://SEU-APP",
       "payment_methods_allowed": { "payment_types": [ { "id": "credit_card" } ] }
     }'
   ```

   Na resposta, copie o **`id`** — é o seu `MP_PREAPPROVAL_PLAN_ID`.

## 3. Segredos e deploy das funções (Supabase CLI)

```bash
npm install -g supabase
supabase login
supabase link --project-ref anigjrfbsdtcjsdqukhl

# segredos usados pelas funções
supabase secrets set \
  MP_ACCESS_TOKEN="SEU_ACCESS_TOKEN" \
  MP_PREAPPROVAL_PLAN_ID="ID_DO_PLANO" \
  APP_URL="https://SEU-APP"

# publica as funções (o webhook não usa JWT)
supabase functions deploy subscribe
supabase functions deploy mp-webhook --no-verify-jwt
```

## 4. Webhook no Mercado Pago

Em **Developers → Webhooks**, cadastre a URL da função:

```
https://anigjrfbsdtcjsdqukhl.supabase.co/functions/v1/mp-webhook
```

Marque o evento **Assinaturas** (`subscription_preapproval`). É esse aviso que
atualiza o status da assinatura no banco (ativa, pausada, cancelada).

## 5. Ligar o paywall no app

No `.env`, defina:

```env
VITE_BILLING_ENABLED=true
```

Rode `npm run build` (ou `npm run dev`). A partir daí, novos usuários caem na
tela **Assinatura** e só entram no app após iniciar a assinatura (que começa
com o mês grátis).

## Como funciona (resumo técnico)

- `subscribe` (autenticada): identifica o usuário pelo JWT, cria a assinatura
  (`preapproval`) no plano do MP e devolve o `init_point` (checkout do cartão).
  O app redireciona o usuário para lá.
- Após o cadastro do cartão, o Mercado Pago chama `mp-webhook`, que consulta o
  status real (`GET /preapproval/{id}`) e grava em `subscriptions` (via
  `service_role`).
- O app lê a própria assinatura (RLS) e libera o acesso quando o status é
  `authorized` (inclui o período de teste grátis). Quando o teste termina, o MP
  cobra automaticamente; se falhar, o status muda e o paywall volta.
