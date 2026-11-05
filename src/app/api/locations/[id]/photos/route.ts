import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

const MAX_SIZE = 8 * 1024 * 1024 // 8 MB per photograph
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

// POST /api/locations/[id]/photos — multipart upload of one or more photos.
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

  const dir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(dir, { recursive: true })

  const saved: { id: string; filename: string; caption: string | null }[] = []
  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || 'unknown'}` },
        { status: 415 }
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `${file.name} exceeds the 8 MB limit` }, { status: 413 })
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const fname = `${randomUUID()}.${ext || 'jpg'}`
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, fname), bytes)
    const photo = await db.photo.create({
      data: { locationId: id, filename: `/uploads/${fname}`, caption },
    })
    saved.push({ id: photo.id, filename: photo.filename, caption: photo.caption })
  }

  const row = await db.location.findUnique({ where: { id }, include: { photos: true } })
  return NextResponse.json({ photos: saved, location: row ? serializeLocation(row) : null }, { status: 201 })
}
