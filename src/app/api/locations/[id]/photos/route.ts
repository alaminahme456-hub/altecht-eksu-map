import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { serializeLocation } from '@/lib/types'
import { uploadCampusPhoto } from '@/lib/storage'

type Ctx = { params: Promise<{ id: string }> }

const MAX_SIZE = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }
  const { id } = await ctx.params
  const location = await db.location.findUnique({ where: { id } })
  if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  const caption = (form.get('caption') as string | null) || null
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
  }

  const invalid = files.find((file) => !ALLOWED.includes(file.type) || file.size > MAX_SIZE)
  if (invalid) {
    if (!ALLOWED.includes(invalid.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${invalid.type || 'unknown'}` }, { status: 415 })
    }
    return NextResponse.json({ error: `${invalid.name} exceeds the 8 MB limit` }, { status: 413 })
  }

  const saved: { id: string; filename: string; caption: string | null }[] = []
  try {
    for (const file of files) {
      const filename = await uploadCampusPhoto(file)
      const photo = await db.photo.create({
        data: { locationId: id, filename, caption },
      })
      saved.push({ id: photo.id, filename: photo.filename, caption: photo.caption })
    }
    const row = await db.location.findUnique({ where: { id }, include: { photos: true } })
    return NextResponse.json({ photos: saved, location: row ? serializeLocation(row) : null }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/locations/:id/photos] Upload failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Photo upload failed' },
      { status: 500 }
    )
  }
}
