// Edge Function: nearby-stations
// Busca os postos de combustível mais próximos PELO SERVIDOR. Isso evita os
// bloqueios de CORS/rede que o navegador do usuário sofre ao chamar Overpass
// ou Foursquare direto — aqui o app só fala com o Supabase.
//
// Ordem: Foursquare (se houver chave) -> OpenStreetMap (Overpass) -> nomes
// via Nominatim para postos sem nome. Sempre retorna os 3 mais próximos.
//
// Entrada (POST JSON): { lat, lng, radius? }
// Saída: { stations: [{ name, lat, lng, distance }], source }
//
// Segredo OPCIONAL: FOURSQUARE_API_KEY (sem ela, usa só o OpenStreetMap).
//
// Deploy: supabase functions deploy nearby-stations

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GAS_CATEGORY = '17069' // "Gas Station" na taxonomia do Foursquare
const FSQ_PROVIDERS = [
  { base: 'https://places-api.foursquare.com/places/search', bearer: true, version: '2025-06-17' },
  { base: 'https://api.foursquare.com/v3/places/search', bearer: false, version: '' },
]
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

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
    const radius = Number(body.radius) || 1500
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ stations: [], error: 'lat/lng inválidos' }, 400)
    }

    // 1) Foursquare (se a chave estiver configurada)
    let stations: Station[] = []
    let source: 'foursquare' | 'osm' | null = null
    const key = Deno.env.get('FOURSQUARE_API_KEY')
    if (key) {
      const fsq = await foursquare(key, lat, lng, radius)
      if (fsq.length) {
        stations = fsq
        source = 'foursquare'
      }
    }

    // 2) OpenStreetMap (Overpass) server-side
    if (!stations.length) {
      stations = await overpass(lat, lng, radius)
      if (stations.length) {
        source = 'osm'
        await enrichNames(stations)
      }
    }

    return json({ stations: stations.slice(0, 3), source })
  } catch (err) {
    console.error(err)
    return json({ stations: [], error: String(err) })
  }
})

// ---------- Foursquare ----------
async function foursquare(key: string, lat: number, lng: number, radius: number): Promise<Station[]> {
  let results = await fsqSearch(key, lat, lng, radius, true)
  if (!results.length) {
    const all = await fsqSearch(key, lat, lng, radius, false)
    results = all.filter(isGasStation)
  }
  return results
    .map((p) => {
      const plat = p.latitude ?? p.geocodes?.main?.latitude
      const plng = p.longitude ?? p.geocodes?.main?.longitude
      return {
        name: (p.name ?? '').trim(),
        lat: plat as number,
        lng: plng as number,
        distance:
          typeof plat === 'number' && typeof plng === 'number'
            ? Math.round(haversine(lat, lng, plat, plng))
            : Number.MAX_SAFE_INTEGER,
      }
    })
    .filter((s) => s.name && typeof s.lat === 'number' && typeof s.lng === 'number')
    .sort((a, b) => a.distance - b.distance)
}

interface FsqPlace {
  name?: string
  latitude?: number
  longitude?: number
  geocodes?: { main?: { latitude?: number; longitude?: number } }
  categories?: Array<{ id?: number; fsq_category_id?: string; name?: string }>
}

async function fsqSearch(
  key: string,
  lat: number,
  lng: number,
  radius: number,
  useCategory: boolean,
): Promise<FsqPlace[]> {
  for (const prov of FSQ_PROVIDERS) {
    try {
      const url = new URL(prov.base)
      url.searchParams.set('ll', `${lat},${lng}`)
      url.searchParams.set('radius', String(radius))
      url.searchParams.set('sort', 'DISTANCE')
      url.searchParams.set('limit', '30')
      url.searchParams.set('fields', 'name,geocodes,latitude,longitude,distance,categories')
      if (useCategory) {
        url.searchParams.set('fsq_category_ids', GAS_CATEGORY)
        url.searchParams.set('categories', GAS_CATEGORY)
      }
      const headers: Record<string, string> = {
        Authorization: prov.bearer ? `Bearer ${key}` : key,
        Accept: 'application/json',
      }
      if (prov.version) headers['X-Places-Api-Version'] = prov.version
      const r = await fetch(url, { headers })
      if (!r.ok) continue
      const data = (await r.json()) as { results?: FsqPlace[] }
      const results = data.results ?? []
      if (results.length) return results
    } catch {
      // próximo provedor
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

// ---------- OpenStreetMap (Overpass) ----------
interface OverpassEl {
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function overpass(lat: number, lng: number, radius: number): Promise<Station[]> {
  const q = `[out:json][timeout:15];
    (
      node["amenity"="fuel"](around:${radius},${lat},${lng});
      way["amenity"="fuel"](around:${radius},${lat},${lng});
    );
    out center 60;`
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      })
      if (!r.ok) continue
      const data = (await r.json()) as { elements?: OverpassEl[] }
      const out: Station[] = []
      const seen = new Set<string>()
      for (const el of data.elements ?? []) {
        const p = el.type === 'node' ? { lat: el.lat!, lng: el.lon! } : el.center ? { lat: el.center.lat, lng: el.center.lon } : null
        if (!p) continue
        const tags = el.tags ?? {}
        const name = tags.name || tags.brand || tags.operator || tags['name:pt'] || ''
        const kk = `${name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`
        if (seen.has(kk)) continue
        seen.add(kk)
        out.push({ name, lat: p.lat, lng: p.lng, distance: Math.round(haversine(lat, lng, p.lat, p.lng)) })
      }
      out.sort((a, b) => a.distance - b.distance)
      return out.slice(0, 3)
    } catch {
      // próximo servidor
    }
  }
  return []
}

// Preenche nomes vazios com o endereço (Nominatim). Server-side pode mandar
// User-Agent, o que o navegador não pode.
async function enrichNames(stations: Station[]): Promise<void> {
  await Promise.all(
    stations.map(async (s) => {
      if (s.name) return
      try {
        const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${s.lat}&lon=${s.lng}`
        const r = await fetch(u, { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'abasteci/1.0 (postos)' } })
        if (r.ok) {
          const d = (await r.json()) as { address?: Record<string, string> }
          const a = d.address ?? {}
          const road = a.road || a.pedestrian || a.neighbourhood
          const area = a.suburb || a.city_district || a.town || a.city
          s.name = road ? `Posto — ${area ? `${road}, ${area}` : road}` : 'Posto de combustível'
        } else {
          s.name = 'Posto de combustível'
        }
      } catch {
        s.name = 'Posto de combustível'
      }
    }),
  )
}

// ---------- utils ----------
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
