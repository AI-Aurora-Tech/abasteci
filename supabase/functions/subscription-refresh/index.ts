// Edge Function: subscription-refresh  (baixa automática / reconciliação)
// Consulta o status REAL da assinatura no Mercado Pago e atualiza a tabela
// subscriptions. Cobre os casos em que o webhook não chegou: ativação após o
// checkout e cancelamento (durante ou depois do teste grátis).
//
// Estratégia de busca:
//   1) pelo mp_preapproval_id já salvo (GET /preapproval/{id})
//   2) senão, procura no MP por external_reference = user.id
//   3) senão, procura por payer_email = e-mail do usuário (fluxo por link)
//
// Segredos: MP_ACCESS_TOKEN

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MP = 'https://api.mercadopago.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Não autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await asUser.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Sessão inválida' }, 401)
    const user = userData.user

    const token = Deno.env.get('MP_ACCESS_TOKEN')!
    const headers = { Authorization: `Bearer ${token}` }
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: row } = await admin
      .from('subscriptions')
      .select('mp_preapproval_id, status, trial_end')
      .eq('user_id', user.id)
      .maybeSingle()

    // 1) pelo id conhecido
    let pre: Record<string, unknown> | null = null
    if (row?.mp_preapproval_id) {
      const r = await fetch(`${MP}/preapproval/${row.mp_preapproval_id}`, { headers })
      if (r.ok) pre = await r.json()
    }

    // 2) e 3) busca
    if (!pre) {
      pre = await search(`${MP}/preapproval/search?external_reference=${encodeURIComponent(user.id)}`, headers)
    }
    if (!pre && user.email) {
      pre = await search(`${MP}/preapproval/search?payer_email=${encodeURIComponent(user.email)}`, headers)
    }

    if (!pre) {
      return json({ status: row?.status ?? 'none' })
    }

    const status = String(pre.status ?? 'pending')
    const nextCharge = (pre.next_payment_date as string) ?? null
    const hasFreeTrial = Boolean((pre.auto_recurring as { free_trial?: unknown } | undefined)?.free_trial)

    await admin.from('subscriptions').upsert({
      user_id: user.id,
      status,
      mp_preapproval_id: pre.id,
      current_period_end: nextCharge,
      trial_end: row?.trial_end ?? (hasFreeTrial ? nextCharge : null),
      updated_at: new Date().toISOString(),
    })

    return json({
      status,
      mpPreapprovalId: pre.id,
      currentPeriodEnd: nextCharge,
      trialEnd: row?.trial_end ?? (hasFreeTrial ? nextCharge : null),
    })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

// Busca no MP e escolhe a melhor assinatura (prioriza ativa, depois a mais recente).
async function search(url: string, headers: Record<string, string>): Promise<Record<string, unknown> | null> {
  const r = await fetch(url, { headers })
  if (!r.ok) return null
  const data = await r.json()
  const results: Record<string, unknown>[] = data.results ?? []
  if (!results.length) return null
  const rank = (s: unknown) => (s === 'authorized' ? 3 : s === 'pending' ? 2 : s === 'paused' ? 1 : 0)
  results.sort((a, b) => {
    const d = rank(b.status) - rank(a.status)
    if (d !== 0) return d
    return String(b.date_created ?? '').localeCompare(String(a.date_created ?? ''))
  })
  return results[0]
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
