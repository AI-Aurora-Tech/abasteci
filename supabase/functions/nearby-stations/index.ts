// Edge Function: nearby-stations
// Busca os postos de combustível mais próximos PELO SERVIDOR (evita bloqueios
// de CORS/rede do navegador). Foursquare e OpenStreetMap (Overpass) rodam EM
// PARALELO e com tempo limitado, para responder rápido.
//
// Entrada (POST JSON): { lat, lng, radius? }
// Saída: { stations: [{ name, lat, lng, distance }], source, diag }
//
// Segredo OPCIONAL: FOURSQUARE_API_KEY (sem ela, usa só o OpenStreetMap).
// Deploy: supabase functions deploy nearby-stations

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UA = 'abasteci/1.0 (gestão de abastecimento; +https://abasteci.auroratech.app.br)'
const GAS_CATEGORY = '17069'
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

    const diag: string[] = ['fn v4 (geoapify+paralelo)']
    const key = Deno.env.get('FOURSQUARE_API_KEY')
    const geoKey = Deno.env.get('GEOAPIFY_API_KEY')

    let geo: Station[] = []
    let fsq: Station[] = []
    let osm: Station[] = []

    // Geoapify, Foursquare e Overpass EM PARALELO (cada um com tempo limitado).
    await Promise.all([
      (async () => {
        if (!geoKey) {
          diag.push('srv-geoapify: sem chave')
          return
        }
        const t0 = Date.now()
        try {
          geo = await withTimeout(geoapify(geoKey, lat, lng, radius, diag), 7000)
          diag.push(`srv-geoapify: ${geo.length} em ${Date.now() - t0}ms`)
        } catch (e) {
          diag.push(`srv-geoapify: erro "${String(e)}" em ${Date.now() - t0}ms`)
        }
      })(),
      (async () => {
        if (!key) {
          diag.push('srv-fsq: sem chave')
          return
        }
        const t0 = Date.now()
        try {
          fsq = await withTimeout(foursquare(key, lat, lng, radius, diag), 6000)
          diag.push(`srv-fsq: ${fsq.length} em ${Date.now() - t0}ms`)
        } catch (e) {
          diag.push(`srv-fsq: erro "${String(e)}" em ${Date.now() - t0}ms`)
        }
      })(),
      (async () => {
        const t0 = Date.now()
        try {
          osm = await overpass(lat, lng, radius)
          diag.push(`srv-osm: ${osm.length} em ${Date.now() - t0}ms`)
        } catch (e) {
          diag.push(`srv-osm: erro "${String(e)}" em ${Date.now() - t0}ms`)
        }
      })(),
    ])

    // Preferência: Geoapify > Foursquare > OpenStreetMap.
    let stations = geo.length ? geo : fsq.length ? fsq : osm
    const source = geo.length ? 'geoapify' : fsq.length ? 'foursquare' : osm.length ? 'osm' : null
    if (source === 'osm') await enrichNames(stations)
    stations = stations.slice(0, 3)

    return json({ stations, source, diag })
  } catch (err) {
    console.error(err)
    return json({ stations: [], error: String(err) })
  }
})

// ---------- Geoapify (grátis, sem cartão) ----------
async function geoapify(key: string, lat: number, lng: number, radius: number, diag: string[]): Promise<Station[]> {
  const url =
    `https://api.geoapify.com/v2/places?categories=service.vehicle.fuel` +
    `&filter=circle:${lng},${lat},${radius}&bias=proximity:${lng},${lat}&limit=10&apiKey=${key}`
  const r = await fetchTimeout(url, { headers: { Accept: 'application/json' } }, 6000)
  diag.push(`  · geoapify: HTTP ${r.status}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = (await r.json()) as {
    features?: Array<{ properties?: { name?: string; address_line1?: string; lat?: number; lon?: number } }>
  }
  const out: Station[] = []
  for (const f of data.features ?? []) {
    const p = f.properties ?? {}
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue
    const name = (p.name || p.address_line1 || 'Posto de combustível').trim()
    out.push({ name, lat: p.lat, lng: p.lon, distance: Math.round(haversine(lat, lng, p.lat, p.lon)) })
  }
  out.sort((a, b) => a.distance - b.distance)
  return out.slice(0, 3)
}

// ---------- Foursquare ----------
async function foursquare(key: string, lat: number, lng: number, radius: number, diag: string[]): Promise<Station[]> {
  let results = await fsqSearch(key, lat, lng, radius, true, diag)
  if (!results.length) {
    const all = await fsqSearch(key, lat, lng, radius, false, diag)
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
  diag: string[],
): Promise<FsqPlace[]> {
  for (const prov of FSQ_PROVIDERS) {
    const host = new URL(prov.base).host
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
      const r = await fetchTimeout(url.toString(), { headers }, 5000)
      const data = (await r.json().catch(() => ({}))) as { results?: FsqPlace[] }
      const n = data.results?.length ?? 0
      diag.push(`  · ${host}${useCategory ? '?cat' : ''}: HTTP ${r.status}, ${n} res`)
      if (!r.ok) continue
      if (n) return data.results!
    } catch (e) {
      diag.push(`  · ${host}: erro "${String(e)}"`)
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
  const q = `[out:json][timeout:12];
    (
      node["amenity"="fuel"](around:${radius},${lat},${lng});
      way["amenity"="fuel"](around:${radius},${lat},${lng});
    );
    out center 60;`
  // Todos os servidores EM PARALELO; o primeiro que responder vence.
  const attempts = OVERPASS.map((url) =>
    fetchTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Accept: 'application/json' },
        body: 'data=' + encodeURIComponent(q),
      },
      9000,
    ).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = (await r.json()) as { elements?: OverpassEl[] }
      return parseOsm(data.elements ?? [], lat, lng)
    }),
  )
  try {
    return await Promise.any(attempts)
  } catch (e) {
    const errs = (e as AggregateError).errors?.map((x) => (x as Error)?.message || String(x)).join(', ')
    throw new Error(errs || 'Overpass indisponível')
  }
}

function parseOsm(elements: OverpassEl[], lat: number, lng: number): Station[] {
  const out: Station[] = []
  const seen = new Set<string>()
  for (const el of elements) {
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
}

async function enrichNames(stations: Station[]): Promise<void> {
  await Promise.all(
    stations.map(async (s) => {
      if (s.name) return
      try {
        const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${s.lat}&lon=${s.lng}`
        const r = await fetchTimeout(u, { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': UA } }, 4000)
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
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
