// Geolocalização: pega a posição do celular e tenta identificar o posto
// de combustível mais próximo usando dados abertos do OpenStreetMap
// (Overpass API para postos; Nominatim como fallback de endereço).
// Tudo roda no navegador do usuário e não exige chave de API.

import { fetchNearbyStations } from './supabase'

export interface Coords {
  lat: number
  lng: number
  accuracy?: number
}

export interface StationResult {
  name: string
  coords: Coords
  distance?: number // metros até o ponto do GPS
}

export function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este dispositivo não suporta geolocalização.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(translateGeoError(err)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  })
}

function translateGeoError(err: GeolocationPositionError): Error {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return new Error('Permissão de localização negada. Autorize o acesso ao GPS e tente de novo.')
    case err.POSITION_UNAVAILABLE:
      return new Error('Não foi possível obter a localização agora.')
    case err.TIMEOUT:
      return new Error('Tempo esgotado ao obter a localização. Tente novamente.')
    default:
      return new Error('Falha ao obter a localização.')
  }
}

function haversine(a: Coords, b: Coords): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * Procura o posto de combustível mais próximo (raio de ~300 m) no
 * OpenStreetMap. Retorna nome + coordenadas, ou null se não encontrar.
 */
async function nearestFuelStation(coords: Coords): Promise<StationResult | null> {
  const radius = 300
  const q = `[out:json][timeout:15];
    (
      node["amenity"="fuel"](around:${radius},${coords.lat},${coords.lng});
      way["amenity"="fuel"](around:${radius},${coords.lat},${coords.lng});
    );
    out center 30;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q),
  })
  if (!res.ok) throw new Error('Falha ao consultar postos próximos.')
  const data = (await res.json()) as { elements?: OverpassEl[] }
  const els = data.elements ?? []
  let best: StationResult | null = null
  for (const el of els) {
    const p = el.type === 'node' ? { lat: el.lat!, lng: el.lon! } : el.center ? { lat: el.center.lat, lng: el.center.lon } : null
    if (!p) continue
    const tags = el.tags ?? {}
    const name = tags.name || tags.brand || tags.operator
    if (!name) continue
    const distance = haversine(coords, p)
    if (!best || distance < (best.distance ?? Infinity)) {
      best = { name, coords: p, distance }
    }
  }
  return best
}

interface OverpassEl {
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// Servidores públicos do Overpass (tenta em ordem; se um falhar, vai pro próximo).
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/** fetch com timeout (AbortController) para não travar num servidor lento. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function parseStations(elements: OverpassEl[], coords: Coords): StationResult[] {
  const out: StationResult[] = []
  const seen = new Set<string>()
  for (const el of elements) {
    const p = el.type === 'node' ? { lat: el.lat!, lng: el.lon! } : el.center ? { lat: el.center.lat, lng: el.center.lon } : null
    if (!p) continue
    const tags = el.tags ?? {}
    // Nome real do posto (marca/operador). Vazio quando o OSM não tem — nesse
    // caso enriquecemos depois com o endereço (Nominatim).
    const name = tags.name || tags.brand || tags.operator || tags['name:pt'] || ''
    const key = `${name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, coords: p, distance: haversine(coords, p) })
  }
  out.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  return out
}

/**
 * Preenche o nome dos postos que vieram sem nome do OSM usando o endereço
 * aproximado (Nominatim, grátis e sem chave). Ex.: "Posto — Av. X, Bairro".
 */
async function enrichStationNames(stations: StationResult[]): Promise<void> {
  // Em paralelo e com timeout — enriquecer o nome não pode atrasar a resposta.
  await Promise.all(
    stations.map(async (s) => {
      if (s.name) return
      try {
        const label = await withTimeout(reverseLabel(s.coords), 4000)
        s.name = label ? `Posto — ${label}` : 'Posto de combustível'
      } catch {
        s.name = 'Posto de combustível'
      }
    }),
  )
}

/**
 * Lista os 3 postos de combustível mais próximos (raio ~1 km). Tenta vários
 * servidores Overpass; só lança erro se TODOS falharem (para diferenciar
 * "sem postos por perto" de "consulta falhou"). Aceita postos sem nome.
 */
export async function nearbyFuelStations(coords: Coords, radius = 1000): Promise<StationResult[]> {
  const q = `[out:json][timeout:15];
    (
      node["amenity"="fuel"](around:${radius},${coords.lat},${coords.lng});
      way["amenity"="fuel"](around:${radius},${coords.lat},${coords.lng});
    );
    out center 60;`
  // Consulta TODOS os servidores em paralelo; o primeiro que responder vence.
  // Muito mais rápido e tolerante a servidores lentos/fora do ar.
  const attempts = OVERPASS_ENDPOINTS.map((url) =>
    fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      },
      7000,
    ).then(async (res) => {
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
      const data = (await res.json()) as { elements?: OverpassEl[] }
      return parseStations(data.elements ?? [], coords).slice(0, 3)
    }),
  )
  // Promise.any: resolve com o primeiro sucesso; só rejeita se TODOS falharem.
  return await firstSuccess(attempts)
}

/** Como Promise.any, mas compatível com targets antigos. */
function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let remaining = promises.length
    if (remaining === 0) {
      reject(new Error('Sem servidores para consultar.'))
      return
    }
    let firstErr: unknown = null
    for (const p of promises) {
      p.then(resolve).catch((e) => {
        if (firstErr === null) firstErr = e
        if (--remaining === 0) reject(firstErr ?? new Error('Todas as consultas falharam.'))
      })
    }
  })
}

// Chave opcional do Google. Se presente, usamos o Google Places (nomes bem
// melhores). Sem ela, o app usa o OpenStreetMap (sem chave, sem custo).
const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()

// Foursquare (grátis, sem cartão): a chave fica no servidor (Edge Function
// nearby-stations). Ative definindo VITE_FOURSQUARE_ENABLED=true.
const FOURSQUARE_ENABLED = import.meta.env.VITE_FOURSQUARE_ENABLED === 'true'

/** Postos via Foursquare (Edge Function com a chave secreta no servidor). */
export async function foursquareNearbyStations(coords: Coords): Promise<StationResult[]> {
  // Timeout: se o Foursquare não responder rápido, não trava — cai no OSM.
  const rows = await withTimeout(fetchNearbyStations(coords.lat, coords.lng), 6000)
  return rows
    .map((s) => ({
      name: s.name,
      coords: { lat: s.lat, lng: s.lng },
      distance: s.distance ?? haversine(coords, { lat: s.lat, lng: s.lng }),
    }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, 3)
}

/** Rejeita se a promise não resolver dentro de `ms` milissegundos. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/**
 * Busca postos pelo Google Places API (New). Retorna nome + coordenadas dos 3
 * mais próximos. Requer VITE_GOOGLE_MAPS_API_KEY (chave restrita por referer).
 */
export async function googleNearbyStations(coords: Coords, radius = 1500): Promise<StationResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY!,
      'X-Goog-FieldMask': 'places.displayName,places.location',
    },
    body: JSON.stringify({
      includedTypes: ['gas_station'],
      maxResultCount: 3,
      rankPreference: 'DISTANCE',
      languageCode: 'pt-BR',
      locationRestriction: {
        circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius },
      },
    }),
  })
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`)
  const data = (await res.json()) as {
    places?: Array<{ displayName?: { text?: string }; location?: { latitude: number; longitude: number } }>
  }
  const out: StationResult[] = []
  for (const p of data.places ?? []) {
    const name = p.displayName?.text
    const loc = p.location
    if (!name || !loc) continue
    const c = { lat: loc.latitude, lng: loc.longitude }
    out.push({ name, coords: c, distance: haversine(coords, c) })
  }
  out.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  return out.slice(0, 3)
}

export interface LocatedStations {
  coords: Coords
  stations: StationResult[]
  label: string | null // endereço aproximado, quando nenhum posto é encontrado
  lookupFailed: boolean // true = a busca de postos falhou (rede), não "sem postos"
  source: 'google' | 'foursquare' | 'osm' | null
}

/** Pega o GPS e devolve os postos próximos (Foursquare/Google se houver, senão OSM). */
export async function locateNearbyStations(): Promise<LocatedStations> {
  const coords = await getPosition()
  let stations: StationResult[] = []
  let lookupFailed = false
  let source: LocatedStations['source'] = null

  // 1) Foursquare (grátis, chave no servidor), se habilitado.
  if (FOURSQUARE_ENABLED) {
    try {
      stations = await foursquareNearbyStations(coords)
      if (stations.length) source = 'foursquare'
    } catch {
      // cai para as próximas fontes
    }
  }

  // 2) Google Places (melhores nomes), se a chave estiver configurada.
  if (!stations.length && GOOGLE_KEY) {
    try {
      stations = await googleNearbyStations(coords)
      if (stations.length) source = 'google'
    } catch {
      // cai para o OpenStreetMap
    }
  }

  // 3) OpenStreetMap (sem chave) — fonte principal quando não há as anteriores.
  if (!stations.length) {
    try {
      stations = await nearbyFuelStations(coords)
      if (stations.length) {
        source = 'osm'
        // Postos sem nome no OSM ganham o endereço aproximado.
        await enrichStationNames(stations)
      }
    } catch {
      lookupFailed = true // a consulta caiu — não é "sem postos por perto"
    }
  }

  let label: string | null = null
  if (!stations.length) {
    try {
      label = await reverseLabel(coords)
    } catch {
      // ignora
    }
  }
  return { coords, stations, label, lookupFailed, source }
}

/** Fallback: endereço aproximado (rua/bairro) via Nominatim. */
async function reverseLabel(coords: Coords): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1` +
    `&lat=${coords.lat}&lon=${coords.lng}`
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
  if (!res.ok) return null
  const data = (await res.json()) as { name?: string; address?: Record<string, string> }
  const a = data.address ?? {}
  const road = a.road || a.pedestrian || a.neighbourhood
  const area = a.suburb || a.city_district || a.town || a.city
  if (data.name) return data.name
  if (road) return area ? `${road}, ${area}` : road
  if (area) return area
  return null
}

/**
 * Fluxo completo: pega o GPS, tenta achar o posto mais próximo e, se não
 * achar, usa o endereço aproximado. Retorna sempre as coordenadas.
 */
export async function locateStation(): Promise<StationResult> {
  const coords = await getPosition()
  try {
    const station = await nearestFuelStation(coords)
    if (station) return station
  } catch {
    // ignora e tenta o fallback de endereço
  }
  try {
    const label = await reverseLabel(coords)
    if (label) return { name: label, coords }
  } catch {
    // ignora
  }
  return { name: '', coords }
}

/** Link para abrir a localização no mapa. */
export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
