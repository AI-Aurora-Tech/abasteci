# 🚗 Integração com a Uber (ganhos do motorista)

Importa os ganhos do motorista (endpoint `GET /v1/partners/payments`) como
**Receitas** no abasteci, para calcular o **lucro real** automaticamente.

> ⚠️ **Aprovação obrigatória:** os escopos `partner.*` da Uber precisam ser
> **aprovados pela Uber** antes de funcionar para outros usuários. Enquanto não
> aprovarem, normalmente só a conta dona do app consegue testar. A disponibilidade
> varia por país. O **Client Secret** é secreto — nunca no código.

## 1. No site da Uber (developer.uber.com)

1. Entre em [developer.uber.com](https://developer.uber.com) → **Dashboard** → **Create app**.
2. Copie o **Client ID** e o **Client Secret**.
3. Em **Redirect URIs**, cadastre exatamente:
   ```
   https://anigjrfbsdtcjsdqukhl.supabase.co/functions/v1/uber-oauth
   ```
4. Na aba **Auth**, solicite os escopos: `partner.accounts`, `partner.payments`,
   `partner.trips` e **envie o pedido de acesso** (revisão da Uber).
5. Aguarde a **aprovação** da Uber.

## 2. Banco de dados

No **SQL Editor**, rode `supabase/migrations/0008_uber.sql`.

## 3. Segredos + deploy das funções (Supabase CLI)

No `supabase/functions/.env.secrets`, preencha `UBER_CLIENT_ID`,
`UBER_CLIENT_SECRET`, `UBER_REDIRECT_URI` (e `APP_URL`). Depois:

```bash
supabase secrets set --env-file supabase/functions/.env.secrets
supabase functions deploy uber-connect
supabase functions deploy uber-status
supabase functions deploy uber-sync
supabase functions deploy uber-disconnect
supabase functions deploy uber-oauth --no-verify-jwt
```

## 4. Ligar no app

No `.env` (ou Vercel), defina:

```env
VITE_UBER_ENABLED=true
```

Na tela **Receitas** aparece o card **Conectar com Uber**. O usuário conecta a
conta (OAuth) e usa **Sincronizar ganhos** para importar os pagamentos como
Receitas do veículo selecionado (sem duplicar).

## Como funciona (resumo técnico)

- `uber-connect`: gera a URL de autorização da Uber (com `state` ligado ao usuário).
- `uber-oauth` (callback): troca o `code` por tokens e guarda em `uber_connections`
  (apenas no servidor — o cliente nunca vê os tokens). Volta para `#/receitas`.
- `uber-status`: diz se está conectado e a última sincronização.
- `uber-sync`: busca `GET /v1/partners/payments`, renova o token se preciso e
  insere as receitas (dedup por `external_id = payment_id`).
- `uber-disconnect`: apaga a conexão.
