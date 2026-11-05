import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'

export async function GET() {
  return NextResponse.json({ admin: await isAdminRequest() })
}
