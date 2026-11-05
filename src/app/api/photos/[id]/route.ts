import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }
  const { id } = await ctx.params
  const photo = await db.photo.findUnique({ where: { id } })
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  await db.photo.delete({ where: { id } })
  try {
    await unlink(path.join(process.cwd(), 'public', photo.filename))
  } catch {
    // file may already be gone; the DB record is the source of truth
  }
  return NextResponse.json({ ok: true })
}
