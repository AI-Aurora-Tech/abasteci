// Edge Function: nearby-stations
// Busca os postos de combustível mais próximos no Foursquare Places, pelo
// SERVIDOR — assim a chave do Foursquare fica secreta (não vai para o app).
//
// Entrada (POST JSON): { lat: number, lng: number, radius?: number }
// Saída: { stations: [{ name, lat, lng, distance }] }  (até 3, por distância)
//
// Segredo necessário:
//   FOURSQUARE_API_KEY  -> chave da API do Foursquare (Service/Legacy key)
//
// Deploy (com verificação de JWT — só usuários logados usam):
//   supabase functions deploy nearby-stations

// CORS embutido (sem import de ../_shared) para funcionar também ao publicar
// pelo editor do painel do Supabase, que não inclui a pasta _shared.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FSQ = 'https://api.foursquare.com/v3/places/search'
const GAS_CATEGORY = '17069' // "Gas Station" na taxonomia do Foursquare v3

interface FsqPlace {
  name?: string
  distance?: number
  geocodes?: { main?: { latitude?: number; longitude?: number } }
  categories?: Array<{ id?: number; name?: string }>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const key = Deno.env.get('FOURSQUARE_API_KEY')
    if (!key) return json({ stations: [], error: 'Foursquare não configurado' })

    const body = await req.json().catch(() => ({}))
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    const radius = Number(body.radius) || 1500
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ stations: [], error: 'lat/lng inválidos' }, 400)
    }

    // 1) tenta já filtrando por categoria "posto"
    let results = await search(key, lat, lng, radius, true)
    // 2) se vier vazio, busca sem filtro e seleciona por categoria/nome
    if (!results.length) {
      const all = await search(key, lat, lng, radius, false)
      results = all.filter(isGasStation)
    }

    const stations = results
      .map((p) => ({
        name: p.name ?? '',
        lat: p.geocodes?.main?.latitude,
        lng: p.geocodes?.main?.longitude,
        distance: p.distance,
      }))
      .filter((s) => s.name && typeof s.lat === 'number' && typeof s.lng === 'number')
      .slice(0, 3)

    return json({ stations })
  } catch (err) {
    console.error(err)
    // Nunca derruba o fluxo do app — devolve vazio para cair no OSM.
    return json({ stations: [], error: String(err) })
  }
})

async function search(
  key: string,
  lat: number,
  lng: number,
  radius: number,
  useCategory: boolean,
): Promise<FsqPlace[]> {
  const url = new URL(FSQ)
  url.searchParams.set('ll', `${lat},${lng}`)
  url.searchParams.set('radius', String(radius))
  url.searchParams.set('sort', 'DISTANCE')
  url.searchParams.set('limit', '10')
  url.searchParams.set('fields', 'name,geocodes,distance,categories')
  if (useCategory) url.searchParams.set('categories', GAS_CATEGORY)

  const r = await fetch(url, {
    headers: { Authorization: key, Accept: 'application/json' },
  })
  if (!r.ok) {
    if (useCategory) return [] // deixa o fallback sem categoria tentar
    throw new Error(`Foursquare HTTP ${r.status}`)
  }
  const data = (await r.json()) as { results?: FsqPlace[] }
  return data.results ?? []
}

function isGasStation(p: FsqPlace): boolean {
  return (p.categories ?? []).some(
    (c) => String(c.id) === GAS_CATEGORY || /gas|fuel|posto|gasolin|combust/i.test(c.name ?? ''),
  )
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
