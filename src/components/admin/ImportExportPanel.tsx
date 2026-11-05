'use client'

/**
 * ImportExportPanel — GeoJSON import / export + starter sample data.
 * Export preserves every original coordinate exactly (round-trip safe).
 * Import validates each feature and reports duplicates and suspicious
 * coordinates without blocking collection work.
 */
import { useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Database, Download, FileUp, Loader2, PlayCircle, Sparkles, Trash2 } from 'lucide-react'
import type { ImportReport } from '@/lib/types'

export default function ImportExportPanel({
  onChanged,
  featureCount,
}: {
  onChanged: () => void
  featureCount: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingGeojson, setPendingGeojson] = useState<string | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState<'dry' | 'import' | 'sample' | 'remove' | null>(null)
  const [preview, setPreview] = useState<ImportReport | null>(null)
  const [finalReport, setFinalReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const exportGeojson = async () => {
    const res = await fetch('/api/geojson')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eksu-campus-data-${new Date().toISOString().slice(0, 10)}.geojson`
    a.click()
    URL.revokeObjectURL(url)
    setNotice('GeoJSON export downloaded — original coordinates preserved.')
  }

  const onPickFile = async (file: File) => {
    setError(null)
    setPreview(null)
    setFinalReport(null)
    setPendingName(file.name)
    const text = await file.text()
    setPendingGeojson(text)
    // automatic dry-run validation
    setBusy('dry')
    try {
      const res = await fetch('/api/geojson?dryRun=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Validation failed')
      setPreview(data as ImportReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this GeoJSON file')
      setPendingGeojson(null)
    } finally {
      setBusy(null)
    }
  }

  const runImport = async () => {
    if (!pendingGeojson) return
    setBusy('import')
    setError(null)
    try {
      const res = await fetch(`/api/geojson${force ? '?force=true' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: pendingGeojson,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setFinalReport(data as ImportReport)
      setPreview(null)
      setPendingGeojson(null)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(null)
    }
  }

  const loadSamples = async () => {
    setBusy('sample')
    setError(null)
    try {
      const res = await fetch('/api/admin/sample-data', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setNotice(`Sample dataset loaded (${data.inserted} added, ${data.skipped} already present). All records are labelled UNVERIFIED.`)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load samples')
    } finally {
      setBusy(null)
    }
  }

  const removeSamples = async () => {
    setBusy('remove')
    setError(null)
    try {
      const res = await fetch('/api/locations?allSample=true', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setNotice(`Removed ${data.deleted} sample records.`)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove samples')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Export */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" /> Export GeoJSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Downloads all {featureCount} records as a WGS84 GeoJSON FeatureCollection with photos,
            verification status and source metadata. Coordinates are written exactly as collected.
          </p>
          <Button size="sm" onClick={exportGeojson}>
            <Download className="h-4 w-4" /> Download eksu-campus-data.geojson
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileUp className="h-4 w-4" /> Import GeoJSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Point, Polygon (building outlines) and LineString (roads / pathways) features are supported.
            Imported records arrive as UNVERIFIED drafts; coordinates are never altered.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onPickFile(f)
              e.target.value = ''
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === 'dry' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Choose .geojson file
          </Button>

          {pendingGeojson && preview && (
            <div className="space-y-2 rounded-lg border p-3 text-xs">
              <p className="font-semibold">Validation preview — {pendingName}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge className="bg-emerald-600 hover:bg-emerald-600">{preview.created} ready to import</Badge>
                {preview.skipped.length > 0 && (
                  <Badge variant="outline" className="border-amber-400 text-amber-700">{preview.skipped.length} skipped</Badge>
                )}
                {preview.suspicious.length > 0 && (
                  <Badge variant="outline" className="border-red-400 text-red-700">{preview.suspicious.length} suspicious</Badge>
                )}
              </div>
              {preview.skipped.length > 0 && (
                <ul className="thin-scroll max-h-24 list-disc space-y-0.5 overflow-y-auto pl-4">
                  {preview.skipped.map((s, i) => (
                    <li key={i}><span className="font-medium">{s.name}</span> — {s.reason}</li>
                  ))}
                </ul>
              )}
              {preview.suspicious.length > 0 && (
                <ul className="thin-scroll max-h-24 list-disc space-y-0.5 overflow-y-auto pl-4 text-red-700">
                  {preview.suspicious.map((s, i) => (
                    <li key={i}><span className="font-medium">{s.name}</span> — {s.reasons.join('; ')}</li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="force-import" checked={force} onCheckedChange={(v) => setForce(v === true)} />
                <Label htmlFor="force-import" className="text-[11px] font-normal">
                  Import duplicates anyway (skip-check disabled)
                </Label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={runImport} disabled={busy !== null}>
                  {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Import {preview.created} features
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setPendingGeojson(null); setPreview(null) }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {finalReport && (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle className="text-sm">Import complete</AlertTitle>
              <AlertDescription className="text-xs">
                {finalReport.created} features imported as unverified drafts
                {finalReport.skipped.length > 0 && ` · ${finalReport.skipped.length} skipped`}
                {finalReport.suspicious.length > 0 && ` · ${finalReport.suspicious.length} flagged suspicious — review in the Data quality tab`}
                . The public map updates immediately — no rebuild needed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sample starter data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" /> Starter sample dataset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Loads the EKSU starter dataset: the public-record campus anchor (7.712°N 5.251°E) plus
            clearly-labelled UNVERIFIED sample records for every category. Useful for training
            surveyors and testing — replace them with real GPS data as field work progresses.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadSamples} disabled={busy !== null}>
              {busy === 'sample' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Load sample data
            </Button>
            <Button size="sm" variant="ghost" className="text-red-700 hover:text-red-800" onClick={removeSamples} disabled={busy !== null}>
              {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove all samples
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
          <AlertDescription className="text-xs">{notice}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
