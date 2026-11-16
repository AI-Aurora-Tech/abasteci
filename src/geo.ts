// Geolocalização: pega a posição do celular e busca os postos mais próximos
// pela Edge Function `nearby-stations` (Google Places, no servidor). O
// navegador só fala com o Supabase; a chave do Google fica secreta no
// servidor, o que também evita bloqueios de CORS/rede do dispositivo.

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

/** Rejeita se a promise não resolver dentro de `ms` milissegundos. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/** Postos via Edge Function (Google Places no servidor, chave secreta). */
async function backendNearbyStations(
  coords: Coords,
): Promise<{ stations: StationResult[]; serverDiag: string[] }> {
  const { stations, diag } = await withTimeout(fetchNearbyStations(coords.lat, coords.lng), 12000)
  const mapped = stations
    .map((s) => ({
      name: s.name,
      coords: { lat: s.lat, lng: s.lng },
      distance: s.distance ?? haversine(coords, { lat: s.lat, lng: s.lng }),
    }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, 5)
  return { stations: mapped, serverDiag: diag }
}

export interface LocatedStations {
  coords: Coords
  stations: StationResult[]
  lookupFailed: boolean // true = a busca falhou (rede/servidor), não "sem postos"
  diag: string[] // diagnóstico (para depurar na tela quando não encontra)
}

const errMsg = (e: unknown): string =>
  e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.message) : String(e)

/** Pega o GPS e devolve os postos próximos (Google Places via servidor). */
export async function locateNearbyStations(): Promise<LocatedStations> {
  const coords = await getPosition()
  const diag: string[] = [`GPS ok (±${Math.round(coords.accuracy ?? 0)}m)`]
  const t0 = Date.now()
  try {
    const { stations, serverDiag } = await backendNearbyStations(coords)
    diag.push(`servidor: ${stations.length} em ${Date.now() - t0}ms`)
    for (const d of serverDiag) diag.push(`  · ${d}`)
    return { coords, stations, lookupFailed: false, diag }
  } catch (e) {
    diag.push(`servidor: erro "${errMsg(e)}" em ${Date.now() - t0}ms`)
    return { coords, stations: [], lookupFailed: true, diag }
  }
}

/** Link para abrir a localização no mapa. */
export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
