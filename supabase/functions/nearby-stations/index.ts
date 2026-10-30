// Edge Function: nearby-stations
// Busca os postos de combustível mais próximos no Foursquare Places, pelo
// SERVIDOR — assim a chave do Foursquare fica secreta (não vai para o app).
//
// Entrada (POST JSON): { lat: number, lng: number, radius?: number }
// Saída: { stations: [{ name, lat, lng, distance }] }  (até 3, por distância)
//
// Segredo necessário:
//   FOURSQUARE_API_KEY  -> chave da API do Foursquare
//
// Tenta a API NOVA (places-api.foursquare.com, auth Bearer) e, se não der,
// a v3 (api.foursquare.com/v3, auth com a chave crua) — assim funciona
// independentemente de qual versão a sua chave usa.
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

const GAS_CATEGORY = '17069' // "Gas Station" na taxonomia do Foursquare

// Provedores testados em ordem. Cada chave costuma funcionar em um deles.
const PROVIDERS = [
  { base: 'https://places-api.foursquare.com/places/search', bearer: true, version: '2025-06-17' },
  { base: 'https://api.foursquare.com/v3/places/search', bearer: false, version: '' },
]

interface FsqPlace {
  name?: string
  distance?: number
  latitude?: number
  longitude?: number
  geocodes?: { main?: { latitude?: number; longitude?: number } }
  categories?: Array<{ id?: number; fsq_category_id?: string; name?: string }>
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

    // 1) com categoria "posto"; 2) se vazio, sem categoria e filtra depois
    let results = await search(key, lat, lng, radius, true)
    if (!results.length) {
      const all = await search(key, lat, lng, radius, false)
      results = all.filter(isGasStation)
    }

    const stations = results
      .map((p) => {
        const plat = p.latitude ?? p.geocodes?.main?.latitude
        const plng = p.longitude ?? p.geocodes?.main?.longitude
        return {
          name: p.name ?? '',
          lat: plat,
          lng: plng,
          distance:
            typeof plat === 'number' && typeof plng === 'number'
              ? Math.round(haversine(lat, lng, plat, plng))
              : (p.distance ?? Number.MAX_SAFE_INTEGER),
        }
      })
      .filter((s) => s.name && typeof s.lat === 'number' && typeof s.lng === 'number')
      .sort((a, b) => a.distance - b.distance) // ordena por distância ANTES de cortar
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
  for (const prov of PROVIDERS) {
    try {
      const url = new URL(prov.base)
      url.searchParams.set('ll', `${lat},${lng}`)
      url.searchParams.set('radius', String(radius))
      url.searchParams.set('sort', 'DISTANCE')
      url.searchParams.set('limit', '30')
      // Campos pedidos: cobre nomes das duas APIs.
      url.searchParams.set('fields', 'name,geocodes,latitude,longitude,distance,categories')
      if (useCategory) {
        url.searchParams.set('fsq_category_ids', GAS_CATEGORY) // API nova
        url.searchParams.set('categories', GAS_CATEGORY) // v3 (a outra ignora)
      }
      const headers: Record<string, string> = {
        Authorization: prov.bearer ? `Bearer ${key}` : key,
        Accept: 'application/json',
      }
      if (prov.version) headers['X-Places-Api-Version'] = prov.version

      const r = await fetch(url, { headers })
      if (!r.ok) continue // tenta o próximo provedor
      const data = (await r.json()) as { results?: FsqPlace[] }
      const results = data.results ?? []
      if (results.length) return results
    } catch {
      // tenta o próximo provedor
    }
  }
  return []
}

function isGasStation(p: FsqPlace): boolean {
  return (p.categories ?? []).some(
    (c) =>
      String(c.id) === GAS_CATEGORY ||
      c.fsq_category_id === GAS_CATEGORY ||
      /gas|fuel|posto|gasolin|combust/i.test(c.name ?? ''),
  )
}

// Distância em metros entre dois pontos (Haversine).
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
