'use client'

/**
 * LocationForm — add / edit a campus record (admin).
 * Captures: name, category, GPS coordinates (point OR outline polygon OR
 * pathway polyline), description, verification status and photographs.
 * Duplicate / suspicious-coordinate warnings are surfaced after save but
 * never block the collection work — the administrator decides.
 */
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Crosshair, Loader2, MapPin, Shapes as PolygonIcon, Route, Save, TriangleAlert, Undo2, X } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'
import { suspiciousReasons } from '@/lib/geo'
import type { LocationDTO, PhotoDTO } from '@/lib/types'
import type { MapPickerProps, PickerMode } from '@/components/admin/MapPicker'
import PhotoUploader from '@/components/admin/PhotoUploader'

const MapPicker = dynamic(() => import('@/components/admin/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-lg border bg-muted md:h-80">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
})

export default function LocationForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing: LocationDTO | null
  onSaved: (loc: LocationDTO, warnings: string[]) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [category, setCategory] = useState<string>(editing?.category ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [geometryType, setGeometryType] = useState<PickerMode>(editing?.geometryType ?? 'point')
  const [status, setStatus] = useState<'draft' | 'verified'>(editing?.status ?? 'draft')
  const [latText, setLatText] = useState(editing ? String(editing.lat) : '')
  const [lngText, setLngText] = useState(editing ? String(editing.lng) : '')
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    editing && editing.geometryType === 'point' ? { lat: editing.lat, lng: editing.lng } : null
  )
  const [vertices, setVertices] = useState<[number, number][]>(editing?.coordinates ?? [])
  const [existingPhotos, setExistingPhotos] = useState<PhotoDTO[]>(editing?.photos ?? [])
  const [staged, setStaged] = useState<{ name: string; url: string; file: File }[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latNum = parseFloat(latText)
  const lngNum = parseFloat(lngText)
  const effective = useMemo(() => {
    if (geometryType === 'point' && Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      return { lat: latNum, lng: lngNum }
    }
    if (geometryType !== 'point' && vertices.length > 0) {
      const mid = vertices[Math.floor(vertices.length / 2)]
      return { lat: mid[1], lng: mid[0] }
    }
    return null
  }, [geometryType, latNum, lngNum, vertices])

  const coordWarnings = effective ? suspiciousReasons(effective.lat, effective.lng) : []

  const setPointFromMap: MapPickerProps['onPointChange'] = (lat, lng) => {
    setPoint({ lat, lng })
    setLatText(lat.toFixed(7))
    setLngText(lng.toFixed(7))
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return setError('Geolocation is not available on this device')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPointFromMap(pos.coords.latitude, pos.coords.longitude)
      },
      () => setError('Could not read your GPS position — allow location access'),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const pickPhotos = (files: File[]) => {
    const next = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }))
    setStaged((prev) => [...prev, ...next])
  }

  const uploadStaged = async (locationId: string) => {
    if (staged.length === 0) return
    setUploading(true)
    try {
      for (const s of staged) {
        const fd = new FormData()
        fd.append('files', s.file)
        const res = await fetch(`/api/locations/${locationId}/photos`, { method: 'POST', body: fd })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Photo upload failed')
        }
      }
      setStaged([])
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setError(null)
    if (!name.trim()) return setError('Please enter the name of the building or location')
    if (!category) return setError('Please select a category')

    let payload: Record<string, unknown>
    if (geometryType === 'point') {
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return setError('Latitude and longitude must be valid decimal degrees (tap the map to pick)')
      }
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return setError('Coordinates out of range — latitude ±90, longitude ±180')
      }
      payload = { name: name.trim(), category, description, lat: latNum, lng: lngNum, geometryType, status, coordinates: null }
    } else {
      const min = geometryType === 'polygon' ? 3 : 2
      if (vertices.length < min) {
        return setError(`${geometryType === 'polygon' ? 'An outline' : 'A pathway'} needs at least ${min} vertices — tap the map to add them`)
      }
      const mid = vertices[Math.floor(vertices.length / 2)]
      payload = {
        name: name.trim(),
        category,
        description,
        lat: mid[1],
        lng: mid[0],
        geometryType,
        coordinates: vertices,
        status,
      }
    }

    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/locations/${editing.id}` : '/api/locations', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, full: true }),
      })
      const data = (await res.json()) as { location?: LocationDTO; warnings?: string[]; error?: string }
      if (!res.ok || !data.location) throw new Error(data.error || 'Save failed')
      await uploadStaged(data.location.id)
      onSaved(data.location, data.warnings ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{editing ? `Edit: ${editing.name}` : 'Add a building or campus location'}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* --- Identification --- */}
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loc-name">Name *</Label>
          <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Faculty of Science Complex" />
        </div>
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Location category">
              <SelectValue placeholder="Select a category…" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end space-y-1.5">
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="verified-switch" className="text-sm font-medium">Mark as verified</Label>
              <p className="text-[11px] text-muted-foreground">Only enable after confirming real GPS data on site</p>
            </div>
            <Switch id="verified-switch" checked={status === 'verified'} onCheckedChange={(v) => setStatus(v ? 'verified' : 'draft')} />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loc-desc">Description</Label>
          <Textarea
            id="loc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happens here, notable features, department housed, etc."
            rows={3}
          />
        </div>
      </div>

      {/* --- Geometry --- */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Label>How is this feature mapped? *</Label>
        <RadioGroup
          value={geometryType}
          onValueChange={(v) => {
            const mode = v as PickerMode
            setGeometryType(mode)
            if (mode === 'point') {
              setVertices([])
            } else {
              setPoint(null)
              setLatText('')
              setLngText('')
            }
          }}
          className="grid grid-cols-3 gap-2"
        >
          {[
            { value: 'point', label: 'Point marker', icon: <MapPin className="h-4 w-4" />, hint: 'Single GPS position' },
            { value: 'polygon', label: 'Outline polygon', icon: <PolygonIcon className="h-4 w-4" />, hint: 'Building footprint' },
            { value: 'polyline', label: 'Path polyline', icon: <Route className="h-4 w-4" />, hint: 'Road / walkway' },
          ].map((opt) => (
            <Label
              key={opt.value}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center text-xs font-medium ${
                geometryType === opt.value ? 'border-teal-700 bg-teal-50 text-teal-900' : 'hover:bg-muted/60'
              }`}
            >
              <RadioGroupItem value={opt.value} className="sr-only" />
              {opt.icon}
              {opt.label}
              <span className="text-[10px] font-normal text-muted-foreground">{opt.hint}</span>
            </Label>
          ))}
        </RadioGroup>

        <MapPicker
          mode={geometryType}
          point={point}
          vertices={vertices}
          onPointChange={setPointFromMap}
          onAddVertex={(lat, lng) => setVertices((prev) => [...prev, [lng, lat]])}
        />

        {geometryType === 'point' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="lat-input">Latitude *</Label>
                <Input
                  id="lat-input"
                  inputMode="decimal"
                  value={latText}
                  onChange={(e) => setLatText(e.target.value)}
                  onBlur={() => {
                    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) setPoint({ lat: latNum, lng: lngNum })
                  }}
                  placeholder="7.712000"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lng-input">Longitude *</Label>
                <Input
                  id="lng-input"
                  inputMode="decimal"
                  value={lngText}
                  onChange={(e) => setLngText(e.target.value)}
                  onBlur={() => {
                    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) setPoint({ lat: latNum, lng: lngNum })
                  }}
                  placeholder="5.251000"
                />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={useMyLocation} className="w-full">
              <Crosshair className="h-4 w-4" /> Use my current GPS position
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tap the map to add vertices in survey order — original coordinates are preserved.
              </p>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setVertices((v) => v.slice(0, -1))} disabled={vertices.length === 0}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo last
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setVertices([])} disabled={vertices.length === 0}>
                  Clear
                </Button>
              </div>
            </div>
            {vertices.length > 0 && (
              <div className="thin-scroll max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2">
                {vertices.map(([lng, lat], i) => (
                  <div key={`${i}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-[11px] font-mono">
                    <span>
                      <span className="mr-2 font-semibold text-teal-800">#{i + 1}</span>
                      lat {lat.toFixed(6)}, lng {lng.toFixed(6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVertices((v) => v.filter((_, j) => j !== i))}
                      className="text-red-600 hover:text-red-800"
                      aria-label={`Delete vertex ${i + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {coordWarnings.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle className="text-sm">Coordinate check</AlertTitle>
            <AlertDescription className="text-xs">
              <ul className="list-disc pl-4">
                {coordWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* --- Photographs --- */}
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <Label>Photographs</Label>
        <PhotoUploader
          existing={existingPhotos}
          staged={staged}
          uploading={uploading}
          onPick={pickPhotos}
          onRemoveStaged={(n) => setStaged((prev) => prev.filter((s) => s.name !== n))}
          onDeleteExisting={
            editing
              ? async (photoId) => {
                  const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' })
                  if (res.ok) setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId))
                }
              : undefined
          }
        />
      </div>

      {/* --- Save bar --- */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 p-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {status === 'verified' ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">✓ Will be saved as VERIFIED</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-400 text-amber-700">Will be saved as DRAFT (unverified)</Badge>
          )}
          <Button onClick={save} disabled={saving || uploading} className="ml-auto flex-1 sm:flex-none">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editing ? 'Save changes' : 'Save record'}
          </Button>
        </div>
      </div>
    </div>
  )
}
