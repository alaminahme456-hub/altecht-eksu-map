// Geospatial helpers implementing the project's data-accuracy policy.
// All math uses the WGS84 haversine great-circle distance (metres).

export const EKSU_CAMPUS_CENTER = {
  lat: 7.712, // 7°42′43″N — public record (Wikipedia), EKSU Ado-Ekiti
  lng: 5.251, // 5°15′04″E
}

// Approximate survey envelope around the main campus (~1.7 km radius).
// Used ONLY to flag suspicious coordinates for review — never to clamp data.
export const CAMPUS_BBOX = {
  minLat: EKSU_CAMPUS_CENTER.lat - 0.016,
  maxLat: EKSU_CAMPUS_CENTER.lat + 0.016,
  minLng: EKSU_CAMPUS_CENTER.lng - 0.017,
  maxLng: EKSU_CAMPUS_CENTER.lng + 0.017,
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

// Total length of a polyline path [[lng,lat], ...] in metres.
export function pathLengthMeters(coords: [number, number][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(
      coords[i - 1][1],
      coords[i - 1][0],
      coords[i][1],
      coords[i][0]
    )
  }
  return total
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

// A coordinate is "suspicious" when it is physically invalid, a null island,
// or far outside the campus survey envelope. Returns reasons (empty = OK).
export function suspiciousReasons(lat: number, lng: number): string[] {
  const reasons: string[] = []
  if (!isValidLatLng(lat, lng)) reasons.push('Invalid latitude/longitude range')
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)
    reasons.push('Null-island coordinate (0, 0)')
  if (
    isValidLatLng(lat, lng) &&
    (lat < CAMPUS_BBOX.minLat ||
      lat > CAMPUS_BBOX.maxLat ||
      lng < CAMPUS_BBOX.minLng ||
      lng > CAMPUS_BBOX.maxLng)
  ) {
    reasons.push(
      'Outside the EKSU campus survey envelope — check GPS capture or datum'
    )
  }
  return reasons
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export type DuplicateCheckInput = {
  id: string
  name: string
  lat: number
  lng: number
}

// Two records are probable duplicates when their names match (normalized)
// and their reference points sit within 75 m, OR when their reference points
// are within 10 m regardless of name.
export function findDuplicatePairs(
  items: DuplicateCheckInput[]
): { a: DuplicateCheckInput; b: DuplicateCheckInput; distance: number; byName: boolean }[] {
  const pairs: { a: DuplicateCheckInput; b: DuplicateCheckInput; distance: number; byName: boolean }[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      const d = haversineMeters(a.lat, a.lng, b.lat, b.lng)
      const byName =
        normalizeName(a.name) === normalizeName(b.name) && a.name.length > 2
      if ((byName && d <= 75) || d <= 10) {
        pairs.push({ a, b, distance: d, byName })
      }
    }
  }
  return pairs
}
