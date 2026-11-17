'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Users, CalendarDays } from 'lucide-react'

type Stats = { today: number; yesterday: number; daily: { date: string; visitors: number }[]; timezone: string }
export default function VisitorAnalyticsPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/analytics/visit', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load visitor statistics')
      setStats(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load visitor statistics') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const max = Math.max(1, ...(stats?.daily.map(d => d.visitors) ?? [1]))
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">Map visitors</h2><p className="text-xs text-muted-foreground">Unique browsers that opened the public EKSU map, counted once per day (Africa/Lagos time).</p></div>
      <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-1 h-3.5 w-3.5"/>Refresh</Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading && !stats ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin"/></div> : stats && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4"/>Today</div><p className="mt-2 text-3xl font-bold tabular-nums">{stats.today.toLocaleString()}</p><Badge className="mt-2 bg-emerald-600 text-white">Unique visitors</Badge></div>
        <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4"/>Yesterday</div><p className="mt-2 text-3xl font-bold tabular-nums">{stats.yesterday.toLocaleString()}</p><Badge variant="secondary" className="mt-2">Unique visitors</Badge></div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-4"><h3 className="font-semibold">Last 14 days</h3><p className="text-xs text-muted-foreground">Daily unique visitors · Nigeria time</p></div>
        <div className="space-y-2">
          {stats.daily.map(day => <div key={day.date} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{new Date(day.date + 'T12:00:00').toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</span>
            <div className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-600" style={{width: (day.visitors / max * 100) + '%'}}/></div>
            <span className="text-right font-semibold tabular-nums">{day.visitors}</span>
          </div>)}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Counts are approximate unique browsers, not verified people. The same visitor using another device or clearing browser cookies may be counted again. Automated bots are not fully filtered.</p>
    </>}
  </div>
}
