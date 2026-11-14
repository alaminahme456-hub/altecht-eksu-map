import { randomUUID } from 'crypto'

/**
 * Small server-only Supabase Data API adapter.
 * Keeps the existing route-level data interface while removing Prisma and
 * PostgreSQL connection strings from the Vercel runtime.
 */
type Query = Record<string, unknown>
type Row = Record<string, any>

function config() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error('Supabase API is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in the deployment environment.')
  }
  return { url: url.replace(/\/$/, ''), key }
}

async function request<T = any>(
  table: string,
  query: Record<string, string> = {},
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<T> {
  const { url, key } = config()
  const params = new URLSearchParams({ select: '*', ...query })
  const response = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, {
    method: options.method ?? 'GET',
    cache: 'no-store',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
  const text = await response.text()
  let data: any = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data
      ? data.message || data.details || data.hint || JSON.stringify(data)
      : String(data || response.statusText)
    throw new Error(`Supabase Data API (${table}) ${response.status}: ${message}`)
  }
  return data as T
}

function filters(where: Query = {}) {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined || value === null) continue
    out[key] = `eq.${String(value)}`
  }
  return out
}

function normalizeDates(row: Row): Row {
  if (!row) return row
  return {
    ...row,
    ...(row.createdAt ? { createdAt: new Date(row.createdAt) } : {}),
    ...(row.updatedAt ? { updatedAt: new Date(row.updatedAt) } : {}),
  }
}

async function withPhotos(rows: Row[], include?: Query): Promise<Row[]> {
  if (!include?.photos || rows.length === 0) return rows.map(normalizeDates)
  const ids = rows.map((row) => row.id).filter(Boolean)
  const photos = ids.length
    ? await request<Row[]>('Photo', { locationId: `in.(${ids.join(',')})`, order: 'createdAt.asc' })
    : []
  return rows.map((row) => ({
    ...normalizeDates(row),
    photos: photos.filter((photo) => photo.locationId === row.id).map(normalizeDates),
  }))
}

async function findMany(args: Query = {}): Promise<Row[]> {
  const query: Record<string, string> = filters(args.where as Query)
  if (args.orderBy && typeof args.orderBy === 'object') {
    const [field, direction] = Object.entries(args.orderBy as Query)[0] ?? []
    if (field) query.order = `${field}.${String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc'}`
  }
  if (args.select && typeof args.select === 'object') {
    query.select = Object.entries(args.select as Query).filter(([, v]) => v).map(([k]) => k).join(',')
  }
  const rows = await request<Row[]>('Location', query)
  return withPhotos(rows, args.include as Query | undefined)
}

async function findFirst(args: Query = {}): Promise<Row | null> {
  const rows = await findMany({ ...args, take: 1 })
  return rows[0] ?? null
}

async function findUnique(args: Query = {}): Promise<Row | null> {
  return findFirst(args)
}

async function createLocation(args: Query): Promise<Row> {
  const now = new Date().toISOString()
  const data = args.data as Row
  const rows = await request<Row[]>('Location', {}, {
    method: 'POST',
    prefer: 'return=representation',
    body: { id: randomUUID(), createdAt: now, updatedAt: now, ...data },
  })
  const row = rows?.[0]
  if (!row) throw new Error('Supabase did not return the created location.')
  return (await withPhotos([row], args.include as Query | undefined))[0]
}

async function updateLocation(args: Query): Promise<Row> {
  const where = filters(args.where as Query)
  const rows = await request<Row[]>('Location', where, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: { ...(args.data as Row), updatedAt: new Date().toISOString() },
  })
  if (!rows?.[0]) throw new Error('Location not found.')
  return (await withPhotos(rows, args.include as Query | undefined))[0]
}

async function deleteLocation(args: Query): Promise<{ count: number }> {
  const rows = await request<Row[]>('Location', filters(args.where as Query), {
    method: 'DELETE',
    prefer: 'return=representation',
  })
  return { count: rows?.length ?? 0 }
}

async function deleteOneLocation(args: Query): Promise<Row> {
  const rows = await request<Row[]>('Location', filters(args.where as Query), {
    method: 'DELETE',
    prefer: 'return=representation',
  })
  if (!rows?.[0]) throw new Error('Location not found.')
  return rows[0]
}

async function createPhoto(args: Query): Promise<Row> {
  const rows = await request<Row[]>('Photo', {}, {
    method: 'POST',
    prefer: 'return=representation',
    body: { id: randomUUID(), createdAt: new Date().toISOString(), ...(args.data as Row) },
  })
  if (!rows?.[0]) throw new Error('Supabase did not return the created photo.')
  return normalizeDates(rows[0])
}

async function findPhoto(args: Query): Promise<Row | null> {
  const rows = await request<Row[]>('Photo', filters(args.where as Query))
  return rows[0] ? normalizeDates(rows[0]) : null
}

async function deletePhoto(args: Query): Promise<Row> {
  const rows = await request<Row[]>('Photo', filters(args.where as Query), {
    method: 'DELETE',
    prefer: 'return=representation',
  })
  if (!rows?.[0]) throw new Error('Photo not found.')
  return normalizeDates(rows[0])
}

export const db = {
  location: {
    findMany,
    findFirst,
    findUnique,
    create: createLocation,
    update: updateLocation,
    delete: deleteOneLocation,
    deleteMany: deleteLocation,
  },
  photo: {
    findUnique: findPhoto,
    create: createPhoto,
    delete: deletePhoto,
  },
}
