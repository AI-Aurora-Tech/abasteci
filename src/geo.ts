// Geolocalização: pega a posição do celular e tenta identificar o posto
// de combustível mais próximo usando dados abertos do OpenStreetMap
// (Overpass API para postos; Nominatim como fallback de endereço).
// Tudo roda no navegador do usuário e não exige chave de API.

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
