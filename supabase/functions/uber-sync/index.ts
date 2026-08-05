// Edge Function: uber-sync
// Busca os ganhos do motorista na Uber (GET /v1/partners/payments) e importa
// como Receitas (platform=Uber), sem duplicar (external_id = payment_id).
// Body: { vehicleId }  — veículo ao qual as receitas serão vinculadas.
//
// Segredos: UBER_CLIENT_ID, UBER_CLIENT_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
    const userId = userData.user.id

    const { vehicleId } = await req.json().catch(() => ({}))
    if (!vehicleId) return json({ error: 'Selecione um veículo para importar as receitas.' }, 400)

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Confere se o veículo é do usuário
    const { data: veh } = await admin.from('vehicles').select('id').eq('id', vehicleId).eq('user_id', userId).maybeSingle()
    if (!veh) return json({ error: 'Veículo inválido.' }, 400)

    const { data: conn } = await admin.from('uber_connections').select('*').eq('user_id', userId).maybeSingle()
    if (!conn) return json({ error: 'Uber não conectada.' }, 400)

    // Renova o token se expirou
    let accessToken = conn.access_token as string
    if (conn.expires_at && new Date(conn.expires_at) <= new Date()) {
      const form = new URLSearchParams({
        client_id: Deno.env.get('UBER_CLIENT_ID')!,
        client_secret: Deno.env.get('UBER_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      })
      const tok = await fetch('https://auth.uber.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      }).then((r) => r.json())
      if (!tok.access_token) return json({ error: 'Falha ao renovar o acesso Uber. Reconecte.' }, 401)
      accessToken = tok.access_token
      await admin.from('uber_connections').update({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? conn.refresh_token,
        expires_at: new Date(Date.now() + (Number(tok.expires_in) || 0) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
    }

    const res = await fetch('https://api.uber.com/v1/partners/payments?limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const detail = await res.text()
      return json({ error: 'Falha ao buscar ganhos na Uber.', status: res.status, detail }, 502)
    }
    const data = await res.json()
    const payments: any[] = data.payments ?? []

    let imported = 0
    for (const p of payments) {
      const amount = Number(p.amount) || 0
      if (amount <= 0) continue
      const when = p.event_time ? new Date(Number(p.event_time) * 1000) : new Date()
      const date = when.toISOString().slice(0, 10)
      const externalId = String(p.payment_id ?? p.trip_id ?? `${p.event_time}-${amount}`)
      const { error } = await admin.from('revenues').upsert(
        {
          user_id: userId,
          vehicle_id: vehicleId,
          date,
          platform: 'Uber',
          description: p.category ?? 'Uber',
          value: amount,
          source: 'uber',
          external_id: externalId,
        },
        { onConflict: 'user_id,external_id' },
      )
      if (!error) imported++
    }

    await admin.from('uber_connections').update({ last_sync: new Date().toISOString() }).eq('user_id', userId)
    return json({ imported, total: payments.length })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
