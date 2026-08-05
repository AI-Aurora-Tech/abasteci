// Edge Function: mp-webhook
// Recebe as notificações do Mercado Pago sobre a assinatura (preapproval),
// consulta o status real na API do MP e atualiza a tabela subscriptions.
//
// Configure a URL desta função como Webhook no painel do Mercado Pago,
// evento "Assinaturas" (subscription_preapproval).
//
// Deploy sem verificação de JWT:
//   supabase functions deploy mp-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    let type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
    let id = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? ''

    // Algumas notificações vêm no corpo em JSON
    if (!id) {
      try {
        const body = await req.json()
        type = body.type ?? body.topic ?? type
        id = body.data?.id ?? body.id ?? ''
      } catch {
        // sem corpo JSON
      }
    }

    // Só tratamos eventos de assinatura
    if (!id || !String(type).includes('preapproval')) {
      return new Response('ignored', { status: 200 })
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
    const pre = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    }).then((r) => r.json())

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Descobre o usuário: pelo external_reference (fluxo API) ou pelo e-mail
    // do pagador (fluxo por link de pagamento).
    let userId: string | undefined = pre.external_reference || undefined
    if (!userId && pre.payer_email) {
      const { data } = await admin.rpc('get_user_id_by_email', { p_email: pre.payer_email })
      if (typeof data === 'string' && data) userId = data
    }
    if (!userId) return new Response('no user match', { status: 200 })

    // Mercado Pago: authorized (ativa, inclui período de teste), paused, cancelled, pending
    const status: string = pre.status ?? 'pending'
    const nextCharge: string | null = pre.next_payment_date ?? null

    // Se há teste grátis, a primeira cobrança marca o fim do trial.
    const { data: current } = await admin
      .from('subscriptions')
      .select('trial_end')
      .eq('user_id', userId)
      .maybeSingle()
    const hasFreeTrial = Boolean(pre.auto_recurring?.free_trial)

    await admin.from('subscriptions').upsert({
      user_id: userId,
      status,
      mp_preapproval_id: id,
      current_period_end: nextCharge,
      trial_end: current?.trial_end ?? (hasFreeTrial ? nextCharge : null),
      updated_at: new Date().toISOString(),
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(err)
    // Retorna 200 para o MP não reenfileirar indefinidamente em erro nosso.
    return new Response('error', { status: 200 })
  }
})
