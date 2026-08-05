// Edge Function: uber-oauth  (callback do OAuth da Uber)
// Recebe ?code&state, troca o code por tokens e salva em uber_connections.
// Cadastre a URL desta função como Redirect URI no app da Uber.
//
// Deploy sem JWT:  supabase functions deploy uber-oauth --no-verify-jwt
// Segredos: UBER_CLIENT_ID, UBER_CLIENT_SECRET, UBER_REDIRECT_URI, APP_URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const APP_URL = Deno.env.get('APP_URL') ?? ''
  const back = (result: string) => Response.redirect(`${APP_URL}#/receitas?uber=${result}`, 302)

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return back('erro')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: st } = await admin.from('uber_oauth_states').select('user_id').eq('state', state).maybeSingle()
    if (!st) return back('erro')

    const form = new URLSearchParams({
      client_id: Deno.env.get('UBER_CLIENT_ID')!,
      client_secret: Deno.env.get('UBER_CLIENT_SECRET')!,
      grant_type: 'authorization_code',
      redirect_uri: Deno.env.get('UBER_REDIRECT_URI')!,
      code,
    })
    const tok = await fetch('https://auth.uber.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    }).then((r) => r.json())

    if (!tok.access_token) {
      console.error('Token Uber:', tok)
      return back('erro')
    }

    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 0) * 1000).toISOString()
    await admin.from('uber_connections').upsert({
      user_id: st.user_id,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tok.scope ?? null,
      connected_at: nowIso,
      updated_at: nowIso,
    })
    await admin.from('uber_oauth_states').delete().eq('state', state)

    return back('ok')
  } catch (err) {
    console.error(err)
    return back('erro')
  }
})
