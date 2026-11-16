// Edge Function: nearby-stations
// Busca os postos de combustível mais próximos no Google Places (API New),
// PELO SERVIDOR — a chave fica secreta e evita bloqueios de CORS/rede do
// navegador do usuário.
//
// Entrada (POST JSON): { lat, lng, radius? }
// Saída: { stations: [{ name, lat, lng, distance }], source, diag }
//
// Segredo necessário: GOOGLE_PLACES_API_KEY
//   (Google Cloud com faturamento ativo + "Places API (New)" habilitada)
//
// Deploy: supabase functions deploy nearby-stations

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Station {
  name: string
  lat: number
  lng: number
  distance: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    const radius = Number(body.radius) || 2500
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ stations: [], error: 'lat/lng inválidos' }, 400)
    }

    const diag: string[] = ['fn google']
    const key = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!key) return json({ stations: [], source: null, diag: [...diag, 'srv-google: sem chave'] })

    const t0 = Date.now()
    try {
      const stations = await google(key, lat, lng, radius)
      diag.push(`srv-google: ${stations.length} em ${Date.now() - t0}ms`)
      return json({ stations: stations.slice(0, 5), source: 'google', diag })
    } catch (e) {
      diag.push(`srv-google: erro "${String(e)}" em ${Date.now() - t0}ms`)
      return json({ stations: [], source: null, diag })
    }
  } catch (err) {
    console.error(err)
    return json({ stations: [], error: String(err) })
  }
})

async function google(key: string, lat: number, lng: number, radius: number): Promise<Station[]> {
  const r = await fetchTimeout(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.location',
      },
      body: JSON.stringify({
        includedTypes: ['gas_station'],
        maxResultCount: 10,
        rankPreference: 'DISTANCE',
        languageCode: 'pt-BR',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      }),
    },
    8000,
  )
  if (!r.ok) {
    // Google devolve o motivo no corpo (billing, API off, restrição de chave…).
    const detail = await r.text().catch(() => '')
    let msg = `HTTP ${r.status}`
    try {
      const j = JSON.parse(detail) as { error?: { message?: string; status?: string } }
      if (j.error?.message) msg = `HTTP ${r.status}: ${j.error.status ?? ''} ${j.error.message}`.trim()
    } catch {
      if (detail) msg = `HTTP ${r.status}: ${detail.slice(0, 180)}`
    }
    throw new Error(msg)
  }
  const data = (await r.json()) as {
    places?: Array<{ displayName?: { text?: string }; location?: { latitude?: number; longitude?: number } }>
  }
  const out: Station[] = []
  for (const p of data.places ?? []) {
    const name = p.displayName?.text
    const loc = p.location
    if (!name || typeof loc?.latitude !== 'number' || typeof loc?.longitude !== 'number') continue
    out.push({ name, lat: loc.latitude, lng: loc.longitude, distance: Math.round(haversine(lat, lng, loc.latitude, loc.longitude)) })
  }
  out.sort((a, b) => a.distance - b.distance)
  return out.slice(0, 5)
}

async function fetchTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    throw (e as Error)?.name === 'AbortError' ? new Error('timeout') : e
  } finally {
    clearTimeout(tm)
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
