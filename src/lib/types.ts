export type GeometryType = 'point' | 'polygon' | 'polyline'
export type LocationStatus = 'draft' | 'verified'

export type PhotoDTO = {
  id: string
  filename: string
  caption?: string | null
}

export type LocationDTO = {
  id: string
  name: string
  category: string
  description?: string | null
  lat: number
  lng: number
  geometryType: GeometryType
  coordinates: [number, number][] | null // [[lng,lat], ...] original vertices
  status: LocationStatus
  source: string
  externalId?: string | null
  photos: PhotoDTO[]
  createdAt: string
  updatedAt: string
}

export type QualityReport = {
  counts: {
    total: number
    verified: number
    draft: number
    photos: number
  }
  duplicates: {
    a: { id: string; name: string }
    b: { id: string; name: string }
    distance: number
    byName: boolean
  }[]
  suspicious: {
    id: string
    name: string
    lat: number
    lng: number
    reasons: string[]
  }[]
}

export type ImportReport = {
  created: number
  skipped: { name: string; reason: string }[]
  suspicious: { name: string; reasons: string[] }[]
}

export function serializeLocation(l: {
  id: string
  name: string
  category: string
  description: string | null
  lat: number
  lng: number
  geometryType: string
  coordinates: string | null
  status: string
  source: string
  externalId: string | null
  photos: { id: string; filename: string; caption: string | null }[]
  createdAt: Date
  updatedAt: Date
}): LocationDTO {
  return {
    id: l.id,
    name: l.name,
    category: l.category,
    description: l.description,
    lat: l.lat,
    lng: l.lng,
    geometryType: l.geometryType as GeometryType,
    coordinates: l.coordinates
      ? (JSON.parse(l.coordinates) as [number, number][])
      : null,
    status: l.status as LocationStatus,
    source: l.source,
    externalId: l.externalId,
    photos: l.photos.map((p) => ({
      id: p.id,
      filename: p.filename,
      caption: p.caption,
    })),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }
}
