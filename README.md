# ⛽ abasteci

Aplicativo de **gestão de veículos e custos** inspirado no [Drivvo](https://www.drivvo.com/pt-BR/).
Controle abastecimentos, despesas, manutenções e lembretes, e acompanhe consumo médio,
custo por quilômetro e gasto mensal — tudo em uma interface simples, em português.

> App web (SPA) em **React + TypeScript + Vite**, com **Supabase** (Postgres + Auth) como
> back-end. Cada usuário faz login por e-mail/senha e vê apenas os próprios dados, isolados
> por **Row Level Security (RLS)**.

## ✨ Funcionalidades

- **Login por e-mail/senha** (Supabase Auth) — dados por usuário, protegidos por RLS.
- **Painel** — KPIs de consumo médio (km/l), custo por km, gasto do mês e hodômetro, com
  gráfico de gasto mensal, próximos lembretes e atividade recente.
- **Abastecimentos** — registro com cálculo automático de litros × preço = total, controle
  de tanque cheio/parcial e cálculo de consumo entre abastecimentos completos.
- **Despesas** — IPVA, seguro, multas, pedágios, estacionamento, lavagem, financiamento e outros.
- **Manutenções** — preventivas e corretivas, com serviço, oficina e hodômetro.
- **Lembretes** — por data, por quilometragem ou ambos, com destaque para vencidos e próximos.
- **Relatórios** — gasto mensal por categoria, composição dos custos, preço médio do litro e
  detalhamento mensal, com filtro de período.
- **Vários veículos** — carros, motos etc., cada um com cor de identificação.
- **Dados de exemplo** — em *Configurações*, um clique insere um carro e uma moto com histórico
  na sua conta para explorar o app.

## 🔧 Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (o plano gratuito basta).
2. No dashboard, abra **SQL Editor → New query**, cole o conteúdo de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e clique em **Run**.
   Isso cria as tabelas e ativa o RLS.
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
4. (Opcional, recomendado para testes) Em **Authentication → Providers → Email**, desative
   *Confirm email* para conseguir entrar logo após criar a conta sem confirmar o e-mail.
5. Na raiz do projeto, crie um arquivo `.env` (baseado em [`.env.example`](.env.example)):

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-public-key
   ```

   > A `anon key` é pública/client-side — a segurança vem do RLS no banco.

### Deu erro de coluna? (PGRST204)

Se ao salvar aparecer algo como *"Could not find the 'fuel_type' column"*, é porque as
tabelas já existiam com uma estrutura diferente e o `create table if not exists` não as
atualizou. Rode **uma vez** o script [`supabase/reset_and_setup.sql`](supabase/reset_and_setup.sql)
no SQL Editor — ele apaga as 5 tabelas e recria com o schema correto (use apenas na fase de
setup, pois apaga os dados).

## 🚀 Como rodar

Requer Node.js 18+.

```bash
npm install
# configure o .env conforme a seção acima
npm run dev      # http://localhost:5173
```

Build de produção:

```bash
npm run build    # gera a pasta dist/
npm run preview  # serve o build gerado
```

Ao abrir, crie sua conta em **Criar conta**, faça login e use *Configurações → Popular com
dados de exemplo* para ver o painel preenchido.

## 🧱 Stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (build e dev server)
- [React Router](https://reactrouter.com/) (navegação, modo hash)
- [Supabase](https://supabase.com/) — Postgres, Auth e Row Level Security
- Gráficos próprios (SVG/CSS), sem dependências extras

## 📁 Estrutura

```
supabase/
└── migrations/
    └── 0001_init.sql   # schema + RLS (rode no SQL Editor)
src/
├── components/
│   ├── Layout.tsx      # navegação, usuário/logout, seletor de veículo
│   └── ui.tsx          # Modal, KPI, gráfico de barras, cabeçalhos
├── pages/
│   ├── Login.tsx       # entrar / criar conta
│   ├── Dashboard.tsx   # painel
│   ├── Fuel.tsx        # abastecimentos
│   ├── Expenses.tsx    # despesas
│   ├── Maintenance.tsx # manutenções
│   ├── Reminders.tsx   # lembretes
│   ├── Reports.tsx     # relatórios
│   ├── Vehicles.tsx    # veículos
│   └── Settings.tsx    # configurações / dados de exemplo / apagar
├── App.tsx             # fluxo: config → sessão → login → app
├── store.tsx           # estado global + auth + CRUD no Supabase
├── supabase.ts         # client Supabase e camada de acesso a dados
├── seed.ts             # dados de exemplo (inseridos no banco)
├── types.ts            # modelos de dados
└── utils.ts            # cálculos (consumo, custo/km) e formatação
```

## 🔐 Segurança (RLS)

Todas as tabelas têm uma coluna `user_id` (padrão `auth.uid()`) e uma política
`for all ... using (auth.uid() = user_id)`. Assim, mesmo usando a chave pública no
navegador, cada usuário só lê e grava as próprias linhas.

## 🗺️ Ideias para evoluir

- Recuperação de senha e login social (Google)
- Módulo de receitas para motoristas de aplicativo (lucro real)
- Sincronização em tempo real (Supabase Realtime) entre dispositivos
- Notificações de lembretes por e-mail (Edge Functions)
- PWA instalável / app nativo

---

Feito como estudo/base de um app de controle veicular. Não afiliado ao Drivvo.
