import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { serializeLocation } from '@/lib/types'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const admin = await isAdminRequest()
  const row = await db.location.findFirst({
    where: { id, ...(!admin ? { status: 'verified' } : {}) },
    include: { photos: true },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ location: serializeLocation(row) })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Allow a lightweight {status} toggle (verify/unverify) as well as full edits.
  const partial = body as { status?: unknown; full?: unknown }
  if (typeof partial.status === 'string' && !partial.full) {
    const status = partial.status === 'verified' ? 'verified' : 'draft'
    const row = await db.location.update({
      where: { id },
      data: { status },
      include: { photos: true },
    })
    return NextResponse.json({ location: serializeLocation(row) })
  }

  const parsed = locationInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }
  const input = parsed.data

  try {
    const row = await db.location.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        description: input.description ?? null,
        lat: input.lat,
        lng: input.lng,
        geometryType: input.geometryType,
        coordinates: input.coordinates ? JSON.stringify(input.coordinates) : null,
        status: input.status,
        externalId: input.externalId ?? null,
      },
      include: { photos: true },
    })
    return NextResponse.json({ location: serializeLocation(row) })
  } catch {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    await db.location.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }
}
