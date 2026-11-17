import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdminRequest } from '@/lib/auth'
import { surveyRequest, newVoterToken, voterHash } from '@/lib/survey-db'

const COOKIE = 'eksu_community_voter'
const cookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

export async function GET(req: NextRequest) {
  try {
    const admin = await isAdminRequest()
    const query: Record<string, string> = { order: 'createdAt.desc', limit: '100' }
    if (!admin) query.isVisible = 'eq.true'
    const rows = await surveyRequest<any[]>('MapComment', query)
    const response = NextResponse.json({
      admin,
      comments: rows.map((row) => ({
        id: row.id,
        body: row.body,
        isVisible: row.isVisible,
        createdAt: row.createdAt,
      })),
    })
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load comments' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const comment = String(body.comment || '').trim()
    if (!comment || comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be between 1 and 500 characters.' }, { status: 400 })
    }

    const token = req.cookies.get(COOKIE)?.value || newVoterToken()
    const hash = voterHash(token)
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recent = await surveyRequest<any[]>('MapComment', {
      visitorHash: `eq.${hash}`,
      createdAt: `gte.${since}`,
      select: 'id',
    })
    if (recent.length >= 3) {
      return NextResponse.json({ error: 'You have reached the comment limit. Please try again later.' }, { status: 429 })
    }

    await surveyRequest('MapComment', {}, 'POST', {
      id: randomUUID(),
      visitorHash: hash,
      body: comment,
      isVisible: true,
      createdAt: new Date().toISOString(),
    })
    const response = NextResponse.json({ success: true }, { status: 201 })
    if (!req.cookies.get(COOKIE)?.value) response.cookies.set(COOKIE, token, cookieOptions)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not submit comment' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  try {
    const body = await req.json()
    const id = String(body.id || '')
    if (!id || typeof body.isVisible !== 'boolean') {
      return NextResponse.json({ error: 'A comment and visibility state are required.' }, { status: 400 })
    }
    const rows = await surveyRequest<any[]>('MapComment', { id: `eq.${id}` }, 'PATCH', { isVisible: body.isVisible })
    return NextResponse.json({ success: !!rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not moderate comment' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Comment id required.' }, { status: 400 })
    await surveyRequest('MapComment', { id: `eq.${id}` }, 'DELETE')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete comment' },
      { status: 500 }
    )
  }
}
