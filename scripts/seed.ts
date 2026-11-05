// One-off seed: loads SAMPLE_DATA into SQLite (idempotent by name).
import { PrismaClient } from '@prisma/client'
import { SAMPLE_DATA } from '../src/lib/sample-data'

const db = new PrismaClient()

async function main() {
  const existing = await db.location.findMany({ select: { name: true } })
  const names = new Set(existing.map((e) => e.name))
  let inserted = 0
  for (const s of SAMPLE_DATA) {
    if (names.has(s.name)) continue
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
    inserted++
  }
  console.log(`Seeded ${inserted} records (skipped ${SAMPLE_DATA.length - inserted} existing).`)
}

main().finally(() => db.$disconnect())
