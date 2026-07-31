// Diagnóstico do Supabase — rode com:  node scripts/check-supabase.mjs
//
// Lê o .env, valida as credenciais, testa a conexão, confere se as tabelas
// existem (SQL rodado?) e faz um cadastro/login de teste.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const OK = '✅'
const NO = '❌'
const WARN = '⚠️ '

function parseEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  } catch {
    console.log(`${NO} Arquivo .env não encontrado na raiz do projeto.`)
    process.exit(1)
  }
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function checkKeyChars(key) {
  // A anon key é um JWT base64url: só A-Z a-z 0-9 - _ .
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i)
    const ch = key[i]
    if (!/[A-Za-z0-9_.-]/.test(ch)) {
      return { ok: false, index: i, code, ch }
    }
  }
  return { ok: true }
}

const env = parseEnv()
const url = (env.VITE_SUPABASE_URL || '').trim()
const key = (env.VITE_SUPABASE_ANON_KEY || '').trim()

console.log('— Diagnóstico abasteci / Supabase —\n')

if (!url || !key) {
  console.log(`${NO} VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes no .env.`)
  process.exit(1)
}
console.log(`${OK} .env lido. URL: ${url}`)

const keyCheck = checkKeyChars(key)
if (!keyCheck.ok) {
  console.log(
    `${NO} A anon key tem um caractere inválido na posição ${keyCheck.index} ` +
      `(código ${keyCheck.code}, "${keyCheck.ch}").`,
  )
  console.log('   → Recrie o .env colando a anon key em UMA linha, sem espaços/quebras.')
  console.log('   → Dica: no Bloco de Notas, cole e salve como .env (Todos os arquivos).')
  process.exit(1)
}
console.log(`${OK} Formato da anon key válido (${key.length} caracteres).`)

const supabase = createClient(url, key)

// 1) Conexão + tabelas
const tables = ['vehicles', 'fuelings', 'expenses', 'maintenances', 'reminders']
let allTablesOk = true
for (const t of tables) {
  const { error } = await supabase.from(t).select('id').limit(1)
  if (error) {
    allTablesOk = false
    if (/does not exist|schema cache|relation/i.test(error.message)) {
      console.log(`${NO} Tabela "${t}" não existe. Rode supabase/migrations/0001_init.sql no SQL Editor.`)
    } else {
      console.log(`${WARN}Tabela "${t}": ${error.message}`)
    }
  }
}
if (allTablesOk) console.log(`${OK} Todas as tabelas existem e respondem.`)

// 2) Auth (cadastro + login de teste)
const email = `teste_${Date.now()}@exemplo.com`
const password = 'senha-de-teste-123'
const { data: signUp, error: signErr } = await supabase.auth.signUp({ email, password })
if (signErr) {
  console.log(`${NO} Cadastro falhou: ${signErr.message}`)
} else if (signUp.session) {
  console.log(`${OK} Cadastro + login funcionando (confirmação de e-mail desligada).`)
} else {
  console.log(`${WARN}Cadastro criado, mas sem sessão — a confirmação de e-mail está LIGADA.`)
  console.log('   → Para testar sem e-mail: Authentication > Providers > Email > desligue "Confirm email".')
}

console.log('\nConcluído.')
process.exit(0)
