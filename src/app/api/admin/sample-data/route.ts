import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { SAMPLE_DATA } from '@/lib/sample-data'

// POST /api/admin/sample-data — load the clearly-labelled EKSU sample
// dataset (one public-record anchor point + UNVERIFIED survey-planning
// samples). Idempotent: records already present are not duplicated.
export async function POST() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }

  const existing = await db.location.findMany({
    where: { source: 'sample' },
    select: { name: true },
  })
  const existingNames = new Set(existing.map((e) => e.name))

  let inserted = 0
  for (const s of SAMPLE_DATA) {
    if (existingNames.has(s.name)) continue
    await db.location.create({
      data: {
        name: s.name,
        category: s.category,
        description: s.description,
        lat: s.lat,
        lng: s.lng,
        geometryType: s.geometryType,
        coordinates: s.coordinates ? JSON.stringify(s.coordinates) : null,
        status: s.status,
        source: s.source,
      },
    })
    inserted += 1
  }

  return NextResponse.json({ inserted, skipped: SAMPLE_DATA.length - inserted })
}
