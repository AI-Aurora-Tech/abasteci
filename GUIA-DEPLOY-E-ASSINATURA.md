# 🚀 Guia completo — publicar o abasteci e ativar a assinatura

Este guia leva do zero até o app publicado (HTTPS) com a **assinatura do Mercado
Pago** funcionando (R$ 4,99/mês, 1 mês grátis, cartão recorrente).

> **Segurança:** o **Access Token do Mercado Pago** e a **service_role key** do
> Supabase são SECRETOS. Nunca coloque no código, não versione, não compartilhe.
> A `anon key` do Supabase é pública (pode ficar no app).

Valores do seu projeto:
- **Supabase ref:** `anigjrfbsdtcjsdqukhl`
- **Supabase URL:** `https://anigjrfbsdtcjsdqukhl.supabase.co`

---

## Pré-requisitos

- **Node.js 18+** — teste com `node -v` (se faltar: `winget install OpenJS.NodeJS.LTS`).
- Contas: **GitHub**, **Vercel** (grátis), **Supabase** (já tem), **Mercado Pago**.

---

## Parte 1 — Subir o código no GitHub

Se ainda não subiu, descompacte o `abasteci-github.zip` e, na pasta:

```powershell
git init
git add .
git commit -m "abasteci"
git branch -M main
git remote add origin https://github.com/AI-Aurora-Tech/abasteci.git
git push -u origin main
```

(ou use o site do GitHub → **Add file → Upload files** e arraste o conteúdo.)

---

## Parte 2 — Publicar na Vercel (gera a URL pública)

1. Entre em [vercel.com](https://vercel.com) com sua conta do GitHub.
2. **Add New… → Project** → importe o repositório `abasteci`.
3. A Vercel detecta **Vite** sozinha (build `npm run build`, saída `dist`).
4. Em **Environment Variables**, adicione:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://anigjrfbsdtcjsdqukhl.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | *(sua anon key)* |
   | `VITE_BILLING_ENABLED` | `false` *(por enquanto)* |

5. Clique **Deploy**. Ao terminar, anote a URL, algo como
   **`https://abasteci.vercel.app`** — é o seu **APP_URL**.

---

## Parte 3 — Ajustar o Supabase

### 3.1 Tabelas (SQL Editor → New query → Run)
Se ainda não rodou, execute em ordem: `0001_init.sql`, `0002`, `0003`, `0004`.
(ou rode `reset_and_setup.sql` para recriar tudo do zero — apaga dados.)

### 3.2 URLs de redirecionamento (para login/recuperação)
**Authentication → URL Configuration:**
- **Site URL:** `https://abasteci.vercel.app`
- **Redirect URLs:** adicione `https://abasteci.vercel.app` e `http://localhost:5173`

### 3.3 (Opcional) Login com Google
- **Google Cloud Console** → crie credencial **OAuth (Web)** com redirect
  `https://anigjrfbsdtcjsdqukhl.supabase.co/auth/v1/callback`.
- **Supabase → Authentication → Providers → Google:** ative e cole *Client ID* e *Secret*.

---

## Parte 4 — Mercado Pago

### 4.1 Access Token
[Painel do MP](https://www.mercadopago.com.br/developers) → **Suas integrações** →
crie uma aplicação (tipo *Assinaturas*) → **Credenciais de produção** → copie o
**Access Token** (começa com `APP_USR-...`).

> Para testar sem cobrar, use as **Credenciais de teste** e cartões de teste.

### 4.2 Criar o plano (R$ 4,99/mês + 1 mês grátis)
Na pasta do projeto (troque pelo seu token e URL):

```powershell
./scripts/create-mp-plan.ps1 -Token "APP_USR-SEU_TOKEN" -AppUrl "https://abasteci.vercel.app"
```

Ele imprime **`MP_PREAPPROVAL_PLAN_ID = ...`** — copie.

---

## Parte 5 — Segredos e deploy das Edge Functions

### 5.1 Instale e faça login no Supabase CLI
```powershell
npm install -g supabase
supabase login
```

### 5.2 Preencha os segredos
Copie `supabase/functions/.env.secrets.example` para
`supabase/functions/.env.secrets` e preencha:

```
MP_ACCESS_TOKEN=APP_USR-SEU_TOKEN
MP_PREAPPROVAL_PLAN_ID=ID_DO_PLANO_DA_PARTE_4
APP_URL=https://abasteci.vercel.app
```

### 5.3 Rode o script (link + secrets + deploy)
```powershell
./scripts/setup-mercadopago.ps1
```

---

## Parte 6 — Webhook no Mercado Pago

**MP → Developers → Webhooks** → cadastre:
- **URL:** `https://anigjrfbsdtcjsdqukhl.supabase.co/functions/v1/mp-webhook`
- **Evento:** *Assinaturas* (`subscription_preapproval`)

---

## Parte 7 — Ligar o paywall

Na **Vercel → Project → Settings → Environment Variables**, mude
`VITE_BILLING_ENABLED` para **`true`** e clique em **Redeploy**.

Pronto! Novos usuários passam a ver a tela de assinatura (com o mês grátis) e o
cartão é cobrado automaticamente após 30 dias.

---

## Parte 8 — Testar

1. Abra a URL da Vercel, crie uma conta.
2. Clique **Começar 1 mês grátis** → você é levado ao checkout do Mercado Pago.
3. Informe o cartão (ou cartão de teste). Ao voltar, o app libera o acesso.
4. Em **Assinatura**, veja *"Teste grátis — faltam 30 dias"*.
5. No Supabase → **Table Editor → subscriptions**, confira o `status = authorized`.

### Cartões de teste do Mercado Pago (ambiente de teste)
- Aprovado: **5031 4332 1540 6351**, CVV 123, validade 11/30, nome `APRO`.
- Mais cartões: [documentação de testes do MP](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/cards).

---

## Problemas comuns

- **"relation ... does not exist"** → falta rodar as migrações (Parte 3.1).
- **Login/recuperação não volta pro app** → URL fora da lista de Redirect URLs (Parte 3.2).
- **Checkout não abre / erro na função** → veja os logs: `supabase functions logs subscribe`.
- **Webhook não atualiza o status** → confira a URL e o evento no MP; veja
  `supabase functions logs mp-webhook`.
- **Paywall não aparece** → `VITE_BILLING_ENABLED` não está `true` na Vercel (e redeploy).
