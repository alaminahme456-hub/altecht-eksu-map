'use client'

/**
 * QualityPanel — data-quality report required by the accuracy policy:
 * probable duplicate records + suspicious coordinates, each with a direct
 * route to fix them in the editor.
 */
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Loader2, MapPinOff, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { formatDistance } from '@/lib/geo'
import type { QualityReport } from '@/lib/types'

export default function QualityPanel({
  report,
  loading,
  onRefresh,
  onEdit,
}: {
  report: QualityReport | null
  loading: boolean
  onRefresh: () => void
  onEdit: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">Data quality</h3>
          <p className="text-xs text-muted-foreground">
            Duplicates and suspicious coordinates detected across all records
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      {report && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat label="Total records" value={report.counts.total} />
          <MiniStat label="Verified" value={report.counts.verified} tone="emerald" />
          <MiniStat label="Unverified drafts" value={report.counts.draft} tone="amber" />
          <MiniStat label="Photographs" value={report.counts.photos} />
          <MiniStat label="Probable duplicates" value={report.duplicates.length} tone={report.duplicates.length ? 'red' : undefined} />
          <MiniStat label="Suspicious coordinates" value={report.suspicious.length} tone={report.suspicious.length ? 'red' : undefined} />
        </div>
      )}

      {!report && !loading && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>No report yet</AlertTitle>
          <AlertDescription>Press Refresh to analyse the current dataset.</AlertDescription>
        </Alert>
      )}

      {report && report.duplicates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Copy className="h-4 w-4 text-red-600" /> Probable duplicates ({report.duplicates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.duplicates.map((d, i) => (
              <div key={`${d.a.id}-${d.b.id}-${i}`} className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={() => onEdit(d.a.id)} className="font-semibold underline-offset-2 hover:underline">{d.a.name}</button>
                  <Badge variant="outline" className="text-[10px]">≈ {formatDistance(d.distance)} apart</Badge>
                  {d.byName && <Badge variant="outline" className="text-[10px]">same name</Badge>}
                  <button onClick={() => onEdit(d.b.id)} className="font-semibold underline-offset-2 hover:underline">{d.b.name}</button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Same/similar name within 75 m, or coordinates within 10 m. Keep one record, or correct the misplaced one.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report && report.suspicious.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPinOff className="h-4 w-4 text-red-600" /> Suspicious coordinates ({report.suspicious.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.suspicious.map((s) => (
              <div key={s.id} className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
                <button onClick={() => onEdit(s.id)} className="font-semibold underline-offset-2 hover:underline">{s.name}</button>
                <p className="mt-0.5 font-mono text-[11px]">{s.lat.toFixed(6)}, {s.lng.toFixed(6)}</p>
                <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-900">
                  {s.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report && report.duplicates.length === 0 && report.suspicious.length === 0 && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>All clear</AlertTitle>
          <AlertDescription>
            No duplicates or suspicious coordinates detected in the current dataset.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-stone-200 bg-stone-50">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle className="text-sm">Accuracy policy</AlertTitle>
        <AlertDescription className="text-xs">
          Records are only marked “verified” after on-site GPS confirmation. Unverified records stay
          clearly labelled on the public map and in every GeoJSON export.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'amber' | 'red' }) {
  const color =
    tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-foreground'
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  )
}
