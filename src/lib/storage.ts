import { randomUUID } from 'crypto'

const BUCKET = 'campus-photos'

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.')
  }
  return { url, key }
}

async function storageRequest(path: string, init: RequestInit = {}) {
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Supabase Storage ${response.status}: ${text || response.statusText}`)
  }
  return text ? JSON.parse(text) : null
}

async function ensureBucket() {
  const { url } = storageConfig()
  try {
    await storageRequest(`/bucket/${BUCKET}`)
    return
  } catch {
    // Create the bucket on first upload. Public read is needed for map photos;
    // all uploads and deletes still pass through authenticated admin routes.
  }
  await storageRequest('/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: 8388608,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    }),
  })
}

export async function uploadCampusPhoto(file: File) {
  await ensureBucket()
  const { url } = storageConfig()
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const objectPath = `locations/${randomUUID()}.${extension}`
  await storageRequest(`/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: await file.arrayBuffer(),
  })
  return `${url}/storage/v1/object/public/${BUCKET}/${objectPath}`
}

export async function removeCampusPhoto(publicUrl: string) {
  const { url } = storageConfig()
  const prefix = `${url}/storage/v1/object/public/${BUCKET}/`
  if (!publicUrl.startsWith(prefix)) return
  const objectPath = publicUrl.slice(prefix.length).split('/').map(encodeURIComponent).join('/')
  await storageRequest(`/object/${BUCKET}/${objectPath}`, { method: 'DELETE' })
}
