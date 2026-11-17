import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { isAdminRequest } from '@/lib/auth'
import { surveyRequest } from '@/lib/survey-db'

const COOKIE = 'eksu_map_visitor'
const cookieOptions = { httpOnly: true as const, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 365 }
const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const visitorHash = (token: string) => createHash('sha256').update((process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'eksu-map-visitor') + ':' + token).digest('hex')

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE)?.value || randomUUID() + randomUUID()
    const hash = visitorHash(token)
    const today = dateKey(new Date())
    await surveyRequest('MapVisit', {}, 'POST', { id: randomUUID(), visitorHash: hash, visitDate: today, createdAt: new Date().toISOString() })
      .catch(async (error) => {
        // A unique-key conflict means this browser has already been counted today.
        if (!String(error).includes('duplicate key') && !String(error).includes('23505')) throw error
      })
    const response = NextResponse.json({ success: true })
    if (!req.cookies.get(COOKIE)?.value) response.cookies.set(COOKIE, token, cookieOptions)
    return response
  } catch (error) {
    console.error('[POST /api/analytics/visit]', error)
    return NextResponse.json({ error: 'Could not record map visit.' }, { status: 500 })
  }
}

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 })
  try {
    const now = new Date()
    const today = dateKey(now)
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterday = dateKey(yesterdayDate)
    const [todayRows, yesterdayRows, recentRows] = await Promise.all([
      surveyRequest<any[]>('MapVisit', { visitDate: 'eq.' + today, select: 'id' }),
      surveyRequest<any[]>('MapVisit', { visitDate: 'eq.' + yesterday, select: 'id' }),
      surveyRequest<any[]>('MapVisit', { select: 'visitDate', order: 'visitDate.desc', limit: '14' })
    ])
    const daily = new Map<string, number>()
    // Fetch per-day totals for the last 14 calendar days in Lagos time.
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      return dateKey(d)
    })
    const grouped = await surveyRequest<any[]>('MapVisit', { select: 'visitDate', visitDate: 'gte.' + dates[dates.length - 1] })
    for (const row of grouped) daily.set(row.visitDate, (daily.get(row.visitDate) || 0) + 1)
    return NextResponse.json({
      today: todayRows.length,
      yesterday: yesterdayRows.length,
      daily: dates.reverse().map(date => ({ date, visitors: daily.get(date) || 0 })),
      timezone: 'Africa/Lagos',
    })
  } catch (error) {
    console.error('[GET /api/analytics/visit]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load visitor statistics.' }, { status: 500 })
  }
}
