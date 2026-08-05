// Edge Function: uber-connect
// Gera a URL de autorização da Uber (OAuth) para o usuário conectar sua conta.
//
// Segredos: UBER_CLIENT_ID, UBER_REDIRECT_URI (= URL da função uber-oauth)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SCOPES = 'partner.accounts partner.payments partner.trips'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Não autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error } = await asUser.auth.getUser(jwt)
    if (error || !userData.user) return json({ error: 'Sessão inválida' }, 401)

    const state = crypto.randomUUID()
    const admin = createClient(supabaseUrl, serviceKey)
    await admin.from('uber_oauth_states').insert({ state, user_id: userData.user.id })

    const params = new URLSearchParams({
      client_id: Deno.env.get('UBER_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: Deno.env.get('UBER_REDIRECT_URI')!,
      scope: SCOPES,
      state,
    })
    return json({ url: `https://auth.uber.com/oauth/v2/authorize?${params.toString()}` })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
