'use client'

/**
 * CampusMapApp — public, mobile-first map view.
 * Search · category filters · location bottom sheet with photos ·
 * user location · straight-line distance measurement · basemap switch ·
 * legend. Data is fetched live from /api/locations, so records added in the
 * admin dashboard appear here WITHOUT rebuilding the map.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type L from 'leaflet'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Crosshair,
  Info,
  Layers,
  Loader2,
  MapPinned,
  Minus,
  Plus,
  Ruler,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { CATEGORIES, categoryMeta } from '@/lib/categories'
import { formatDistance, haversineMeters, pathLengthMeters } from '@/lib/geo'
import type { LocationDTO } from '@/lib/types'
import type { FlyTarget, MapCoreProps } from '@/components/map/MapCore'

const MapCore = dynamic(() => import('@/components/map/MapCore'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#dfe6d9]">
      <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm shadow">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading campus map…
      </div>
    </div>
  ),
})

export default function CampusMapApp() {
  const [locations, setLocations] = useState<LocationDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'draft'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flyTarget, setFlyTarget] = useState<FlyTarget>(null)
  const [basemap, setBasemap] = useState<'illustrated' | 'osm'>('osm')
  const [userPos, setUserPos] = useState<MapCoreProps['userPos']>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lng: number }[]>([])
  const [showLegend, setShowLegend] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/locations', { cache: 'no-store' })
      const data = (await res.json()) as { locations: LocationDTO[] }
      setLocations(data.locations ?? [])
    } catch {
      // keep previous data on transient failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return locations.filter((l) => {
      if (activeCategories.size > 0 && !activeCategories.has(l.category)) return false
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      return true
    })
  }, [locations, activeCategories, statusFilter])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return locations
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          (l.description ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [locations, query])

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId]
  )

  const selectLocation = (l: LocationDTO, zoom = 18) => {
    setSelectedId(l.id)
    setFlyTarget({ lat: l.lat, lng: l.lng, zoom, key: Date.now() })
    setSheetOpen(true)
  }

  const toggleCategory = (c: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const locateMe = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Location is not supported on this device')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        setUserPos(p)
        setLocating(false)
        setFlyTarget({ ...p, zoom: 17, key: Date.now() })
      },
      (err) => {
        setLocating(false)
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — allow it to see where you are'
            : 'Could not determine your location'
        )
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  const handleMeasurePoint = (lat: number, lng: number) => {
    setMeasurePoints((prev) => (prev.length >= 2 ? [{ lat, lng }] : [...prev, { lat, lng }]))
  }

  const measureDistance =
    measurePoints.length === 2
      ? haversineMeters(measurePoints[0].lat, measurePoints[0].lng, measurePoints[1].lat, measurePoints[1].lng)
      : null

  const toggleMeasure = () => {
    setMeasureMode((m) => !m)
    setMeasurePoints([])
    if (!measureMode) {
      setSheetOpen(false)
      setSelectedId(null)
    }
  }

  const distanceFromUser =
    selected && userPos
      ? haversineMeters(userPos.lat, userPos.lng, selected.lat, selected.lng)
      : null

  const selectedPathLength = selected?.coordinates ? pathLengthMeters(selected.coordinates) : null

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <MapCore
        locations={filtered}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id)
          setSheetOpen(id !== null)
        }}
        userPos={userPos}
        measureMode={measureMode}
        measurePoints={measurePoints}
        onMeasurePoint={handleMeasurePoint}
        basemap={basemap}
        flyTarget={flyTarget}
        onMapReady={(m) => (mapRef.current = m)}
      />

      {/* ---------- Top bar: title + search ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 rounded-xl border bg-white/95 p-2 shadow-md backdrop-blur">
          <div className="flex items-center gap-1.5 pl-1.5 pr-1 text-primary">
            <MapPinned className="h-5 w-5 shrink-0" />
            <span className="hidden text-sm font-bold leading-tight sm:block">
              ALTECH EKSU
              <span className="block text-[10px] font-medium text-muted-foreground">Campus Map</span>
            </span>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buildings, faculties, gates…"
              className="h-9 border-0 bg-muted/60 pl-8 focus-visible:ring-1"
              aria-label="Search campus locations"
            />
            {searchResults.length > 0 && (
              <div className="absolute inset-x-0 top-11 overflow-hidden rounded-lg border bg-white shadow-lg">
                <ScrollArea className="max-h-64">
                  {searchResults.map((l) => {
                    const meta = categoryMeta(l.category)
                    return (
                      <button
                        key={l.id}
                        onClick={() => {
                          selectLocation(l)
                          setQuery('')
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs"
                          style={{ borderColor: meta.color }}
                        >
                          {meta.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{l.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{l.category}</span>
                        </span>
                        {l.status === 'draft' && (
                          <Badge variant="outline" className="shrink-0 text-[9px] uppercase text-amber-700 border-amber-300">
                            unverified
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </ScrollArea>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 text-xs"
            onClick={() => (window.location.hash = '#/admin')}
          >
            Admin
          </Button>
        </div>

        {/* ---------- Category filter chips ---------- */}
        <div className="pointer-events-auto chip-scroll mx-auto mt-2 flex max-w-xl gap-1.5 pb-1">
          <button
            onClick={() => setActiveCategories(new Set())}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
              activeCategories.size === 0 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white/95'
            }`}
          >
            All ({locations.length})
          </button>
          {CATEGORIES.map((c) => {
            const meta = categoryMeta(c)
            const active = activeCategories.has(c)
            const count = locations.filter((l) => l.category === c).length
            if (count === 0) return null
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
                  active ? 'text-white' : 'bg-white/95'
                }`}
                style={active ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
                aria-pressed={active}
              >
                {meta.icon} {c.replace(' buildings', 's').replace(' facilities', 's').replace('Entrances and gates', 'Gates').replace('Roads and pathways', 'Paths')} ({count})
              </button>
            )
          })}
          <button
            onClick={() => setStatusFilter((s) => (s === 'all' ? 'verified' : s === 'verified' ? 'draft' : 'all'))}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
              statusFilter === 'verified'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : statusFilter === 'draft'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white/95'
            }`}
          >
            {statusFilter === 'all' ? 'Verified + unverified' : statusFilter === 'verified' ? '✓ Verified only' : '⚠ Unverified only'}
          </button>
        </div>
      </div>

      {/* ---------- Floating controls (right) ---------- */}
      <div className="absolute bottom-28 right-3 z-[1000] flex flex-col gap-2 sm:bottom-24">
        <MapButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="h-4.5 w-4.5" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="h-4.5 w-4.5" />
        </MapButton>
        <MapButton
          label="Show my location"
          onClick={locateMe}
          active={!!userPos}
        >
          {locating ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Crosshair className="h-4.5 w-4.5" />}
        </MapButton>
        <MapButton
          label="Measure distance between two points"
          onClick={toggleMeasure}
          active={measureMode}
        >
          <Ruler className="h-4.5 w-4.5" />
        </MapButton>
        <MapButton
          label={`Basemap: ${basemap === 'osm' ? 'Standard OSM' : 'Illustrated'} — tap to switch`}
          onClick={() => setBasemap((b) => (b === 'illustrated' ? 'osm' : 'illustrated'))}
        >
          <Layers className="h-4.5 w-4.5" />
        </MapButton>
        <MapButton label="Map legend" onClick={() => setShowLegend((s) => !s)} active={showLegend}>
          <Info className="h-4.5 w-4.5" />
        </MapButton>
      </div>

      {/* ---------- Measure chip ---------- */}
      {measureMode && (
        <div className="absolute inset-x-0 top-[7.5rem] z-[1000] mx-auto w-fit max-w-[92%]">
          <div className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            <Ruler className="h-4 w-4" />
            {measureDistance !== null ? (
              <>
                <span>Straight-line distance: {formatDistance(measureDistance)}</span>
                <button
                  onClick={() => setMeasurePoints([])}
                  className="rounded-full bg-white/25 px-2 py-0.5"
                >
                  Restart
                </button>
                <button onClick={toggleMeasure} aria-label="Exit measure mode">
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : measurePoints.length === 1 ? (
              <span>Tap the second point…</span>
            ) : (
              <span>Tap the first point on the map…</span>
            )}
          </div>
        </div>
      )}

      {geoError && (
        <div className="absolute inset-x-0 bottom-6 z-[1000] mx-auto w-fit">
          <div className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-lg">
            <TriangleAlert className="h-4 w-4" /> {geoError}
            <button onClick={() => setGeoError(null)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------- Legend ---------- */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 z-[1000] w-72 max-w-[86%] rounded-xl border bg-white/97 p-3 text-xs shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Map legend</p>
            <button onClick={() => setShowLegend(false)} aria-label="Close legend">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-[11px]">🎓</span>
            <span>Verified location — GPS confirmed by an administrator</span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-stone-500 bg-stone-50 text-[11px]">⚠️</span>
            <span>Unverified location — approximate, pending survey</span>
          </div>
          <Separator className="my-2" />
          <p className="mb-1 font-semibold">Categories</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {CATEGORIES.map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryMeta(c).color }}
                />
                {c}
              </span>
            ))}
          </div>
          <Separator className="my-2" />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Map anchor: EKSU main campus 7.712°N 5.251°E (public record). Dashed grey circle is an
            approximate campus envelope, not a surveyed boundary. Unverified sample records await
            replacement by real GPS survey data via the Admin dashboard.
          </p>
        </div>
      )}

      {/* ---------- Location bottom sheet ---------- */}
      <Drawer open={sheetOpen && !!selected} onOpenChange={(o) => { setSheetOpen(o); if (!o) setSelectedId(null) }}>
        <DrawerContent className="max-h-[70dvh]">
          {selected && (
            <div className="thin-scroll overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
              <DrawerTitle className="sr-only">{selected.name}</DrawerTitle>
              <DrawerDescription className="sr-only">
                {selected.category} — {selected.status === 'verified' ? 'verified location' : 'unverified location'}
              </DrawerDescription>
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold leading-tight">{selected.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="text-white"
                      style={{ backgroundColor: categoryMeta(selected.category).color }}
                    >
                      {categoryMeta(selected.category).icon} {selected.category}
                    </Badge>
                    {selected.status === 'verified' ? (
                      <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                        <ShieldCheck className="h-3 w-3" /> Verified GPS location
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                        <TriangleAlert className="h-3 w-3" /> Unverified — approximate
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setSheetOpen(false)
                    setSelectedId(null)
                  }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {selected.description && (
                <p className="mt-3 text-sm leading-relaxed text-foreground/85">{selected.description}</p>
              )}

              {selected.photos.length > 0 && (
                <div className="chip-scroll mt-3 flex gap-2">
                  {selected.photos.map((p) => (
                    <a key={p.id} href={p.filename} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={p.filename}
                        alt={`Photograph of ${selected.name}`}
                        className="h-24 w-32 rounded-lg border object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <InfoCell
                  label="Latitude"
                  value={selected.geometryType === 'point' ? selected.lat.toFixed(6) : `${selected.lat.toFixed(6)} (ref.)`}
                />
                <InfoCell
                  label="Longitude"
                  value={selected.geometryType === 'point' ? selected.lng.toFixed(6) : `${selected.lng.toFixed(6)} (ref.)`}
                />
                {selectedPathLength !== null && (
                  <InfoCell label="Path length" value={formatDistance(selectedPathLength)} />
                )}
                {distanceFromUser !== null && (
                  <InfoCell label="Distance from you" value={formatDistance(distanceFromUser)} />
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMeasureMode(true)
                    setMeasurePoints([{ lat: selected.lat, lng: selected.lng }])
                    setSheetOpen(false)
                  }}
                >
                  <Ruler className="h-4 w-4" /> Measure from here
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (userPos) {
                      setFlyTarget({ lat: userPos.lat, lng: userPos.lng, zoom: 17, key: Date.now() })
                    } else {
                      locateMe()
                    }
                    setSheetOpen(false)
                  }}
                >
                  <Crosshair className="h-4 w-4" /> Where am I
                </Button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Walking turn-by-turn directions activate once the pathway network is fully surveyed
                (admin-recorded paths are already nav-ready polylines).
              </p>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {loading && (
        <div className="absolute bottom-3 left-3 z-[900] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs shadow">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading campus data…
        </div>
      )}
    </div>
  )
}

function MapButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <Button
      size="icon"
      variant="outline"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-10 w-10 rounded-full border bg-white/95 shadow-md backdrop-blur hover:bg-muted ${
        active ? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-800' : ''
      }`}
    >
      {children}
    </Button>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-semibold">{value}</p>
    </div>
  )
}
