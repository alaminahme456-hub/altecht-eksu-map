import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { removeCampusPhoto } from '@/lib/storage'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  }
  const { id } = await ctx.params
  const photo = await db.photo.findUnique({ where: { id } })
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  try {
    await removeCampusPhoto(photo.filename)
    await db.photo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/photos/:id] Failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Photo deletion failed' },
      { status: 500 }
    )
  }
}
