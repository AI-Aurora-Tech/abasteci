# Assinatura (Mercado Pago) — configuração

O app cobra **R$ 4,99/mês** com **1 mês grátis**, cartão informado no cadastro e
cobrança recorrente automática depois. O fluxo usa **duas Edge Functions**
(`subscribe` e `mp-webhook`) e a tabela `subscriptions`.

> Enquanto não terminar esta configuração, mantenha `VITE_BILLING_ENABLED=false`
> no `.env` — o app funciona normalmente, sem o paywall.

> **⚠️ Segurança:** o **Access Token** é secreto. Nunca coloque no código nem no
> repositório e não compartilhe em chat/e-mail. Se ele vazar, **gere um novo** no
> painel do Mercado Pago imediatamente. Ele só deve ser configurado como *segredo*
> no Supabase (`supabase secrets set`).

## Recomendado: cartão no cadastro + 30 dias grátis (sem cobrança agora)

Para o comportamento "o usuário cadastra o cartão para garantir a assinatura,
ganha 30 dias grátis, nada é cobrado agora e pode cancelar quando quiser", use o
**fluxo B (plano + trial)**:

1. Crie o **plano com `free_trial` de 1 mês** (`scripts/create-mp-plan.*`). Com
   isso, ao cadastrar o cartão a assinatura fica `authorized` e a **1ª cobrança
   só ocorre após 30 dias**.
2. Configure `MP_PREAPPROVAL_PLAN_ID` e publique as funções `subscribe`,
   `mp-webhook` e `cancel-subscription`.
3. Deixe `VITE_MP_CHECKOUT_URL` **vazio** no app (assim o botão usa a função
   `subscribe`, que aplica o teste grátis por usuário).

O paywall já força esse cadastro logo após a criação da conta, e a tela de
assinatura tem o botão **Cancelar assinatura** (função `cancel-subscription`).

## Dois caminhos de cobrança

- **A) Link de pagamento (mais simples):** você cria um link de assinatura no
  Mercado Pago (mpago.la/...) e coloca em `VITE_MP_CHECKOUT_URL`. O botão "Assinar"
  abre esse link. Só precisa da Edge Function **`mp-webhook`** (para liberar o
  acesso). O webhook identifica o usuário pelo **e-mail do pagador** (requer a
  migração `0007_billing_link.sql`). Não precisa da função `subscribe` nem do
  `MP_PREAPPROVAL_PLAN_ID`.
- **B) API (plano + trial por usuário):** as duas funções (`subscribe` e
  `mp-webhook`) e o `MP_PREAPPROVAL_PLAN_ID`. Passos completos abaixo.

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

> **Atalho:** em vez dos comandos manuais abaixo, você pode usar os scripts prontos
> `scripts/create-mp-plan.ps1` (cria o plano) e `scripts/setup-mercadopago.ps1`
> (segredos + deploy). Versões `.sh` também estão disponíveis.

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
supabase functions deploy cancel-subscription
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
