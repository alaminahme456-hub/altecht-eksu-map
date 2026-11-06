import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { serializeLocation } from '@/lib/types'
import { CATEGORIES } from '@/lib/categories'
import { suspiciousReasons } from '@/lib/geo'
import { haversineMeters, normalizeName } from '@/lib/geo'

// ---------------------------------------------------------------------------
// GET /api/geojson — export every campus record as a GeoJSON FeatureCollection.
// Coordinates are emitted EXACTLY as stored (no rounding, no reprojection).
// ---------------------------------------------------------------------------
export async function GET() {
  const admin = await isAdminRequest()
  const rows = await db.location.findMany({
    where: admin ? {} : { status: 'verified' },
    include: { photos: true },
    orderBy: { createdAt: 'asc' },
  })
  const locations = rows.map(serializeLocation)

  const features = locations.map((l) => {
    let geometry
    if (l.geometryType === 'polygon' && l.coordinates && l.coordinates.length >= 3) {
      geometry = { type: 'Polygon', coordinates: [l.coordinates] }
    } else if (l.geometryType === 'polyline' && l.coordinates && l.coordinates.length >= 2) {
      geometry = { type: 'LineString', coordinates: l.coordinates }
    } else {
      geometry = { type: 'Point', coordinates: [l.lng, l.lat] }
    }
    return {
      type: 'Feature',
      id: l.id,
      geometry,
      properties: {
        id: l.id,
        name: l.name,
        category: l.category,
        description: l.description ?? '',
        status: l.status, // draft = unverified, verified = admin-confirmed GPS data
        source: l.source,
        externalId: l.externalId ?? null,
        photoCount: l.photos.length,
        photos: l.photos.map((p) => p.filename),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      },
    }
  })

  return NextResponse.json({
    type: 'FeatureCollection',
    metadata: {
      name: 'ALTECH EKSU Campus Map — collected campus data',
      crs: 'WGS84 (EPSG:4326) — coordinates preserved exactly as collected',
      exportedAt: new Date().toISOString(),
      featureCount: features.length,
      note: 'status=draft records are UNVERIFIED and must not be treated as confirmed campus data.',
    },
    features,
  })
}

// ---------------------------------------------------------------------------
// POST /api/geojson — admin import of a GeoJSON FeatureCollection.
// - Point        → point marker
// - Polygon      → building outline (outer ring preserved verbatim)
// - LineString   → road / walking pathway
// Records are imported as UNVERIFIED (draft) unless the feature explicitly
// carries properties.status === 'verified' from a previous trusted export.
// ?dryRun=true validates and reports without saving. ?force=true imports
// even when a probable duplicate already exists.
// ---------------------------------------------------------------------------
type FeatureLike = {
  type?: string
  geometry?: { type?: string; coordinates?: unknown } | null
  properties?: Record<string, unknown> | null
}

function toCategory(props: Record<string, unknown>): string {
  const raw = String(props.category ?? props.Category ?? '').trim()
  if ((CATEGORIES as readonly string[]).includes(raw)) return raw
  const amenity = String(props.amenity ?? '').toLowerCase()
  const highway = String(props.highway ?? '').toLowerCase()
  const building = String(props.building ?? '').toLowerCase()
  if (highway) return 'Roads and pathways'
  if (amenity === 'university' || amenity === 'college') return 'Other campus facilities'
  if (amenity === 'library') return 'Libraries'
  if (amenity === 'clinic' || amenity === 'hospital' || amenity === 'pharmacy') return 'Health facilities'
  if (amenity === 'cafeteria' || amenity === 'restaurant' || amenity === 'canteen') return 'Cafeterias'
  if (amenity === 'dormitory' || building === 'dormitory' || amenity === 'student_centre') return 'Hostels'
  if (amenity === 'fuel' || amenity === 'parking' || amenity === 'marketplace') return 'Other campus facilities'
  if (building) return 'Other campus facilities'
  return 'Other campus facilities'
}

function firstOf<T>(v: unknown): T[] | null {
  return Array.isArray(v) && v.every((x) => Array.isArray(x)) ? (v as T[]) : null
}

function centroid(coords: [number, number][]): [number, number] {
  let sx = 0
  let sy = 0
  for (const [x, y] of coords) {
    sx += x
    sy += y
  }
  return [sx / coords.length, sy / coords.length] // [lng, lat]
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dryRun') === 'true'
  const force = searchParams.get('force') === 'true'

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 })
  }

  const collection = body as { type?: string; features?: FeatureLike[] }
  const features: FeatureLike[] =
    collection?.type === 'FeatureCollection' && Array.isArray(collection.features)
      ? collection.features
      : (body as FeatureLike)?.type === 'Feature'
        ? [body as FeatureLike]
        : []

  if (features.length === 0) {
    return NextResponse.json(
      { error: 'Not a GeoJSON FeatureCollection (or contains no features)' },
      { status: 422 }
    )
  }

  const report = { created: 0, skipped: [] as { name: string; reason: string }[], suspicious: [] as { name: string; reasons: string[] }[] }

  const existing = await db.location.findMany({
    select: { id: true, name: true, lat: true, lng: true, externalId: true },
  })

  for (let i = 0; i < features.length; i++) {
    const f = features[i]
    const props = (f.properties ?? {}) as Record<string, unknown>
    const name = String(props.name ?? props.Name ?? `Unnamed feature ${i + 1}`).slice(0, 200)
    const geomType = f.geometry?.type
    const coordsUnknown = f.geometry?.coordinates

    // --- build our internal shape -----------------------------------------
    let lat: number | null = null
    let lng: number | null = null
    let geometryType: 'point' | 'polygon' | 'polyline' = 'point'
    let vertexCoords: [number, number][] | null = null

    if (geomType === 'Point' && Array.isArray(coordsUnknown)) {
      const c = coordsUnknown as number[]
      lng = c[0]
      lat = c[1]
      geometryType = 'point'
    } else if (geomType === 'Polygon') {
      const rings = firstOf<[number, number][]>(coordsUnknown)
      if (rings && rings[0] && rings[0].length >= 3) {
        vertexCoords = rings[0]
        geometryType = 'polygon'
        ;[lng, lat] = centroid(vertexCoords)
      }
    } else if (geomType === 'LineString' && firstOf<[number, number]>(coordsUnknown)) {
      vertexCoords = firstOf<[number, number]>(coordsUnknown)!
      if (vertexCoords.length >= 2) {
        geometryType = 'polyline'
        const mid = vertexCoords[Math.floor(vertexCoords.length / 2)]
        lng = mid[0]
        lat = mid[1]
      }
    }

    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      report.skipped.push({ name, reason: `Unsupported or malformed geometry (${geomType ?? 'none'})` })
      continue
    }

    // --- duplicates --------------------------------------------------------
    // Same normalized name within 75 m, or reference coordinates within 10 m,
    // or a previously imported externalId — matching the quality-report rules.
    const externalId = props.externalId ? String(props.externalId) : props['@id'] ? String(props['@id']) : props.osm_id != null ? String(props.osm_id) : null
    const norm = normalizeName(name)
    const dupExisting = existing.find(
      (e) =>
        (externalId && e.externalId && e.externalId === externalId) ||
        (normalizeName(e.name) === norm && norm.length > 2 && haversineMeters(e.lat, e.lng, lat, lng) <= 75) ||
        (!externalId && haversineMeters(e.lat, e.lng, lat, lng) <= 10)
    )
    if (dupExisting && !force) {
      report.skipped.push({ name, reason: `Duplicate of existing record “${dupExisting.name}”` })
      continue
    }

    // --- suspicious coordinates (imported anyway, flagged for review) ------
    const reasons = suspiciousReasons(lat, lng)
    if (reasons.length > 0) report.suspicious.push({ name, reasons })

    if (!dryRun) {
      const created = await db.location.create({
        data: {
          name,
          category: toCategory(props),
          description: props.description ? String(props.description) : null,
          lat,
          lng,
          geometryType,
          coordinates: vertexCoords ? JSON.stringify(vertexCoords) : null,
          status: props.status === 'verified' ? 'verified' : 'draft',
          source: 'import',
          externalId,
        },
      })
      existing.push({ id: created.id, name: created.name, lat: created.lat, lng: created.lng, externalId: created.externalId })
    }
    report.created += 1
  }

  return NextResponse.json(report)
}
