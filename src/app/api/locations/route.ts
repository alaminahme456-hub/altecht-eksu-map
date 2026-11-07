import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { locationInputSchema } from '@/lib/validation'
import { serializeLocation } from '@/lib/types'
import { findDuplicatePairs, suspiciousReasons } from '@/lib/geo'

// GET /api/locations?q=&category=&status=
// Public: feeds the live map. Coordinates are returned exactly as stored.
// Search is evaluated case-insensitively in JS (SQLite `contains` is
// case-sensitive, which would break ordinary campus searches).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const category = searchParams.get('category') || ''
  const status = searchParams.get('status') || ''

  const admin = await isAdminRequest()
  const rows = await db.location.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(admin && status ? { status } : {}),
      ...(!admin ? { status: 'verified' } : {}),
    },
    include: { photos: true },
    orderBy: { name: 'asc' },
  })

  const locations = rows
    .filter(
      (r) =>
        q.length === 0 ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    )
    .map(serializeLocation)

  return NextResponse.json({ locations })
}

// POST /api/locations — admin only. Creates a record; returns data-quality
// warnings (duplicates / suspicious coordinates) without blocking the save.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = locationInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }
  const input = parsed.data

  if (input.geometryType === 'polygon' && (!input.coordinates || input.coordinates.length < 3)) {
    return NextResponse.json(
      { error: 'A polygon outline needs at least 3 vertices' },
      { status: 422 }
    )
  }

  const created = await db.location.create({
    data: {
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      lat: input.lat,
      lng: input.lng,
      geometryType: input.geometryType,
      coordinates: input.coordinates ? JSON.stringify(input.coordinates) : null,
      status: input.status,
      source: 'admin',
      externalId: input.externalId ?? null,
    },
    include: { photos: true },
  })

  // Duplicate + suspicious checks for the freshly created record.
  const all = await db.location.findMany({
    select: { id: true, name: true, lat: true, lng: true },
  })
  const dupPairs = findDuplicatePairs(all).filter(
    (p) => p.a.id === created.id || p.b.id === created.id
  )
  const warnings: string[] = []
  for (const p of dupPairs) {
    const other = p.a.id === created.id ? p.b : p.a
    warnings.push(
      `Possible duplicate of “${other.name}” (${Math.round(p.distance)} m apart${p.byName ? ', similar name' : ''})`
    )
  }
  for (const r of suspiciousReasons(created.lat, created.lng)) warnings.push(r)

  return NextResponse.json(
    { location: serializeLocation(created), warnings },
    { status: 201 }
  )
}

// DELETE /api/locations?allSample=true — admin: remove all sample/demo records.
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  if (searchParams.get('allSample') === 'true') {
    const res = await db.location.deleteMany({ where: { source: 'sample' } })
    return NextResponse.json({ deleted: res.count })
  }
  return NextResponse.json({ error: 'Specify allSample=true' }, { status: 400 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Use POST/PATCH' }, { status: 405 })
}
