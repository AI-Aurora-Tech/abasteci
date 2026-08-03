// Edge Function: subscribe
// Cria (ou reaproveita) a assinatura do usuário no Mercado Pago e devolve a
// URL (init_point) para o usuário cadastrar o cartão. A assinatura usa um
// plano com 1 mês de teste grátis + R$ 4,99/mês (criado no painel do MP).
//
// Segredos necessários (supabase secrets set ...):
//   MP_ACCESS_TOKEN          -> Access Token do Mercado Pago (produção)
//   MP_PREAPPROVAL_PLAN_ID   -> id do plano de assinatura (com free_trial)
//   APP_URL                  -> URL do app (back_url após o checkout)
// Injetados automaticamente pelo Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Não autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Identifica o usuário a partir do JWT
    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await asUser.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Sessão inválida' }, 401)
    const user = userData.user

    const admin = createClient(supabaseUrl, serviceKey)

    // Se já houver assinatura ativa, não recria
    const { data: existing } = await admin
      .from('subscriptions')
      .select('status, mp_preapproval_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing?.status === 'authorized') {
      return json({ alreadyActive: true })
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
    const PLAN_ID = Deno.env.get('MP_PREAPPROVAL_PLAN_ID')!
    const APP_URL = Deno.env.get('APP_URL') ?? ''

    // Cria a assinatura (preapproval) vinculada ao plano
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: PLAN_ID,
        reason: 'abasteci — assinatura mensal',
        external_reference: user.id,
        payer_email: user.email,
        back_url: APP_URL,
        status: 'pending',
      }),
    })
    const mp = await mpRes.json()
    if (!mpRes.ok) {
      console.error('Erro MP:', mp)
      return json({ error: 'Falha ao criar assinatura no Mercado Pago', detail: mp }, 502)
    }

    // Salva o vínculo (status pending até o webhook confirmar)
    await admin.from('subscriptions').upsert({
      user_id: user.id,
      status: 'pending',
      mp_preapproval_id: mp.id,
      updated_at: new Date().toISOString(),
    })

    return json({ init_point: mp.init_point ?? mp.sandbox_init_point })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
