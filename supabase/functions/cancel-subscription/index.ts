// Edge Function: cancel-subscription
// Cancela a assinatura do usuário no Mercado Pago (status=cancelled) e
// atualiza a tabela subscriptions. O usuário pode cancelar a qualquer momento.
//
// Deploy:  supabase functions deploy cancel-subscription

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

    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await asUser.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Sessão inválida' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: sub } = await admin
      .from('subscriptions')
      .select('mp_preapproval_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (!sub?.mp_preapproval_id) return json({ error: 'Assinatura não encontrada' }, 404)

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
    const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      return json({ error: 'Falha ao cancelar no Mercado Pago', detail }, 502)
    }

    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', userData.user.id)

    return json({ ok: true })
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
