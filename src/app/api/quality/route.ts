import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { serializeLocation, type QualityReport } from '@/lib/types'
import { findDuplicatePairs, suspiciousReasons } from '@/lib/geo'

// GET /api/quality — admin-only data-quality report required by the
// project's data-accuracy policy: probable duplicate records and
// suspicious coordinates (invalid / null-island / outside survey envelope).
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }

  const rows = await db.location.findMany({ include: { photos: true }, orderBy: { name: 'asc' } })
  const locations = rows.map(serializeLocation)

  const dupPairs = findDuplicatePairs(
    locations.map((l) => ({ id: l.id, name: l.name, lat: l.lat, lng: l.lng }))
  )

  const suspicious = locations.flatMap((l) => {
    const reasons = suspiciousReasons(l.lat, l.lng)
    return reasons.length > 0
      ? [{ id: l.id, name: l.name, lat: l.lat, lng: l.lng, reasons }]
      : []
  })

  const report: QualityReport = {
    counts: {
      total: locations.length,
      verified: locations.filter((l) => l.status === 'verified').length,
      draft: locations.filter((l) => l.status === 'draft').length,
      photos: locations.reduce((n, l) => n + l.photos.length, 0),
    },
    duplicates: dupPairs.map((p) => ({
      a: { id: p.a.id, name: p.a.name },
      b: { id: p.b.id, name: p.b.name },
      distance: p.distance,
      byName: p.byName,
    })),
    suspicious,
  }

  return NextResponse.json(report)
}
