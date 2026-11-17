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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Crosshair,
  Info,
  Loader2,
  MapPinned,
  Minus,
  Plus,
  Navigation,
  Search,
  Share2,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { CATEGORIES, categoryMeta } from '@/lib/categories'
import { EKSU_CAMPUS_CENTER, formatDistance, haversineMeters, pathLengthMeters } from '@/lib/geo'
import type { LocationDTO } from '@/lib/types'
import { routeOnRecordedPaths } from '@/lib/path-routing'
import type { FlyTarget, MapCoreProps } from '@/components/map/MapCore'
import SurveyPanel from '@/components/map/SurveyPanel'
import CommunityPanel from '@/components/map/CommunityPanel'
import ExpandableActionButton from '@/components/ui/expandable-action-button'
import MapBackHandler from '@/components/map/MapBackHandler'

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
  const [gatePromptOpen, setGatePromptOpen] = useState(false)
  const [gatePickerOpen, setGatePickerOpen] = useState(false)
  const [directionPickerOpen, setDirectionPickerOpen] = useState(false)
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([])
  const [routeSummary, setRouteSummary] = useState<{ distance: number; duration: number } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [navigationDestination, setNavigationDestination] = useState<LocationDTO | null>(null)
  const [navigationStatus, setNavigationStatus] = useState<'active' | 'rerouting' | null>(null)
  const routeCoordinatesRef = useRef<[number, number][]>([])
  const reroutingRef = useRef(false)
  const lastOffRouteAlertRef = useRef(0)
  const [showLegend, setShowLegend] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [sharedLocation, setSharedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [sharedLocationNotice, setSharedLocationNotice] = useState(false)
  const [shareAfterLocateOpen, setShareAfterLocateOpen] = useState(false)

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

  // Count this browser once per Lagos calendar day. The server owns the visitor cookie.
  useEffect(() => {
    void fetch('/api/analytics/visit', { method: 'POST', cache: 'no-store', keepalive: true }).catch(() => {})
  }, [])

  // Shared-location links open this same EKSU map and focus the shared point.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('sharedLocation')
    if (!raw) return
    const [lat, lng] = raw.split(',').map(Number)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return
    setSharedLocation({ lat, lng })
    setFlyTarget({ lat, lng, zoom: 18, key: Date.now() })
    setSharedLocationNotice(true)
  }, [])

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

  const campusVicinityRadiusMeters = 1200

  const gateLocations = useMemo(
    () => locations.filter((location) =>
      location.category.trim().toLowerCase() === 'entrances and gates' &&
      location.geometryType === 'point' &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng)
    ),
    [locations]
  )

  const decodePolyline6 = (encoded: string): [number, number][] => {
    const points: [number, number][] = []
    let index = 0, lat = 0, lng = 0
    while (index < encoded.length) {
      let result = 0, shift = 0, byte = 0
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      lat += (result & 1) ? ~(result >> 1) : (result >> 1)
      result = 0; shift = 0
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      lng += (result & 1) ? ~(result >> 1) : (result >> 1)
      points.push([lat / 1e6, lng / 1e6])
    }
    return points
  }

  const buildRoute = async (
    destination: LocationDTO,
    originOverride?: { lat: number; lng: number; accuracy?: number }
  ) => {
    let origin = originOverride ?? userPos
    setRouteError(null)
    if (!origin) {
      if (!navigator.geolocation) { setRouteError('Location is not supported on this device.'); return }
      setRouteLoading(true)
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }))
        origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
        setUserPos(origin)
      } catch {
        setRouteLoading(false)
        setRouteError('Allow location access so we can find your starting point.')
        return
      }
    }
    setRouteLoading(true)
    try {
      // Prefer the real campus walkways surveyed and saved by administrators.
      const recordedRoute = routeOnRecordedPaths(locations, origin, { lat: destination.lat, lng: destination.lng })
      if (recordedRoute) {
        setRouteCoordinates(recordedRoute.coordinates)
        setRouteSummary({ distance: recordedRoute.distance, duration: recordedRoute.distance / 1.25 })
        routeCoordinatesRef.current = recordedRoute.coordinates
        reroutingRef.current = false
        lastOffRouteAlertRef.current = 0
        setNavigationDestination(destination)
        setNavigationStatus('active')
        setFlyTarget({ lat: destination.lat, lng: destination.lng, zoom: 18, key: Date.now() })
        setSelectedId(destination.id)
        setSheetOpen(false)
        setDirectionPickerOpen(false)
        setGatePickerOpen(false)
        return
      }

      // Until the recorded network covers both ends, use the OSM pedestrian router.
      const request = { locations: [{ lat: origin.lat, lon: origin.lng }, { lat: destination.lat, lon: destination.lng }], costing: 'pedestrian', units: 'kilometers', directions_options: { units: 'kilometers' } }
      const response = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(request))}`)
      if (!response.ok) throw new Error('Walking route service is temporarily unavailable.')
      const data = await response.json()
      const leg = data?.trip?.legs?.[0]
      if (!leg?.shape) throw new Error('No mapped walking path was found for this route.')
      const route = decodePolyline6(leg.shape)
      if (route.length < 2) throw new Error('The walking route could not be drawn.')
      setRouteCoordinates(route)
      routeCoordinatesRef.current = route
      setRouteSummary({ distance: Number(data.trip.summary.length) * 1000, duration: Number(data.trip.summary.time) })
      reroutingRef.current = false
      lastOffRouteAlertRef.current = 0
      setNavigationDestination(destination)
      setNavigationStatus('active')
      setFlyTarget({ lat: destination.lat, lng: destination.lng, zoom: 18, key: Date.now() })
      setSelectedId(destination.id)
      setSheetOpen(false)
      setDirectionPickerOpen(false)
      setGatePickerOpen(false)
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Could not calculate a walking route.')
    } finally { setRouteLoading(false) }
  }


  routeCoordinatesRef.current = routeCoordinates

  const speakNavigation = (message: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(message)
    speech.lang = 'en-NG'
    speech.rate = 0.95
    window.speechSynthesis.speak(speech)
  }

  const distanceToRouteMeters = (point: { lat: number; lng: number }, route: [number, number][]) => {
    if (route.length < 2) return Infinity
    const sx = 111320 * Math.cos(point.lat * Math.PI / 180)
    const sy = 110540
    let min = Infinity
    for (let i = 1; i < route.length; i++) {
      const ax = (route[i - 1][1] - point.lng) * sx
      const ay = (route[i - 1][0] - point.lat) * sy
      const bx = (route[i][1] - point.lng) * sx
      const by = (route[i][0] - point.lat) * sy
      const dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
      min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy))
    }
    return min
  }

  useEffect(() => {
    if (!navigationDestination || !navigator.geolocation) {
      setNavigationStatus(null)
      return
    }
    const destination = navigationDestination
    const watchId = navigator.geolocation.watchPosition((position) => {
      const current = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }
      setUserPos(current)
      // Ignore noisy fixes so a weak GPS signal does not trigger false reroutes.
      if (current.accuracy > 35) return

      const remaining = haversineMeters(current.lat, current.lng, destination.lat, destination.lng)
      if (remaining <= 18) {
        setNavigationDestination(null)
        setNavigationStatus(null)
        setRouteCoordinates([])
        setRouteSummary(null)
        speakNavigation('You have arrived at your destination.')
        return
      }

      const offRouteBy = distanceToRouteMeters(current, routeCoordinatesRef.current)
      if (offRouteBy > 35 && !reroutingRef.current) {
        const now = Date.now()
        if (now - lastOffRouteAlertRef.current < 12000) return
        lastOffRouteAlertRef.current = now
        reroutingRef.current = true
        setNavigationStatus('rerouting')
        speakNavigation('You are off route. Recalculating.')
        void buildRoute(destination, current).finally(() => {
          reroutingRef.current = false
          setNavigationStatus('active')
        })
      }
    }, () => {
      setGeoError('Live GPS signal was interrupted. Check that location is enabled.')
    }, { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [navigationDestination])

  const stopNavigation = () => {
    setNavigationDestination(null)
    setNavigationStatus(null)
    setRouteCoordinates([])
    setRouteSummary(null)
    reroutingRef.current = false
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  const openGateDirections = (gate: LocationDTO) => { void buildRoute(gate) }

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
        const distanceFromCampusCenter = haversineMeters(
          p.lat,
          p.lng,
          EKSU_CAMPUS_CENTER.lat,
          EKSU_CAMPUS_CENTER.lng
        )
        if (distanceFromCampusCenter > campusVicinityRadiusMeters) {
          setGatePromptOpen(true)
          setShareAfterLocateOpen(false)
        } else {
          setShareAfterLocateOpen(true)
        }
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

  const shareLocatedPosition = () => {
    if (!userPos) { shareMyLocation(); return }
    const url = `${window.location.origin}/?sharedLocation=${encodeURIComponent(`${userPos.lat},${userPos.lng}`)}`
    setShareUrl(url)
    setShareError(null)
    setShareAfterLocateOpen(false)
  }

  const shareMyLocation = () => {
    if (!navigator.geolocation) { setShareError('Location is not supported on this device.'); setShareUrl(''); return }
    setShareBusy(true)
    setShareError(null)
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const url = `${window.location.origin}/?sharedLocation=${encodeURIComponent(`${lat},${lng}`)}`
      setUserPos({ lat, lng, accuracy: pos.coords.accuracy })
      setShareUrl(url)
      setShareBusy(false)
    }, (error) => {
      setShareError(error.code === error.PERMISSION_DENIED ? 'Allow location access to share your position.' : 'Could not get your current location. Try again.')
      setShareUrl('error')
      setShareBusy(false)
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }

  const shareLocationLink = async () => {
    if (!shareUrl) return
    if (navigator.share) {
      try { await navigator.share({ title: 'My location', text: 'Here is my current location.', url: shareUrl }) }
      catch { /* User cancelled the share sheet. */ }
    } else {
      await navigator.clipboard.writeText(shareUrl)
    }
  }

  const distanceFromUser =
    selected && userPos
      ? haversineMeters(userPos.lat, userPos.lng, selected.lat, selected.lng)
      : null

  const selectedPathLength = selected?.coordinates ? pathLengthMeters(selected.coordinates) : null

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <MapBackHandler onBack={() => {
        setSheetOpen(false)
        setSelectedId(null)
        setShowLegend(false)
        setDirectionPickerOpen(false)
        setGatePickerOpen(false)
        setGatePromptOpen(false)
        setShareAfterLocateOpen(false)
        setSharedLocationNotice(false)
        setShareUrl(null)
        setShareError(null)
        setQuery('')
        stopNavigation()
        setFlyTarget({ ...EKSU_CAMPUS_CENTER, zoom: 16, key: Date.now() })
      }} />
      <MapCore
        locations={filtered}
        sharedLocation={sharedLocation}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id)
          setSheetOpen(id !== null)
        }}
        userPos={userPos}
        routeCoordinates={routeCoordinates}
        basemap={basemap}
        flyTarget={flyTarget}
        onMapReady={(m) => (mapRef.current = m)}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md border border-white/70 bg-white/80 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-stone-700 shadow-sm backdrop-blur">
        MADE BY <span className="font-extrabold text-stone-950">ALTECH</span>
      </div>

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
        <MapButton label="Need direction" onClick={() => { setRouteError(null); setDirectionPickerOpen(true) }} active={routeCoordinates.length > 0}>
          <Navigation className="h-4.5 w-4.5" />
        </MapButton>
        <MapButton label="Map legend" onClick={() => setShowLegend((s) => !s)} active={showLegend}>
          <Info className="h-4.5 w-4.5" />
        </MapButton>
        <CommunityPanel />
      </div>

      {routeSummary && routeCoordinates.length > 1 && (
        <div className="absolute inset-x-0 top-[7.5rem] z-[1000] mx-auto w-fit max-w-[92%]">
          <div className="flex items-center gap-2 rounded-full border bg-white/95 px-4 py-2 text-xs font-semibold shadow-lg">
            <Navigation className="h-4 w-4 text-primary" />
            {navigationStatus === 'rerouting' ? 'Recalculating route…' : navigationDestination ? `Navigating to ${navigationDestination.name}` : 'Walking route'} · {formatDistance(routeSummary.distance)} · {Math.max(1, Math.round(routeSummary.duration / 60))} min
            <button onClick={stopNavigation} aria-label="Stop navigation" className="ml-1"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {(geoError || routeError) && (
        <div className="absolute inset-x-0 bottom-6 z-[1000] mx-auto w-fit max-w-[92%]"><div className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-lg"><TriangleAlert className="h-4 w-4" /> {routeError || geoError}<button onClick={() => { setGeoError(null); setRouteError(null) }} aria-label="Dismiss"><X className="h-4 w-4" /></button></div></div>
      )}

      {/* ---------- Legend ---------- */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 z-[1000] w-80 max-w-[90%] max-h-[78dvh] overflow-y-auto rounded-xl border bg-white/97 p-3 text-xs shadow-xl">
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
          <div className="flex items-center gap-2 py-0.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-[11px] text-white">📶</span><span>Smart School Wi-Fi sublocation</span></div>
          <div className="flex items-center gap-2 py-0.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-700"/><span>Wi-Fi available</span><span className="h-2.5 w-2.5 rounded-full bg-amber-600"/><span>Under maintenance</span></div>
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
          <SurveyPanel />
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
                    {selected.category === 'Smart School Wi-Fi' ? (
                      <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                        <TriangleAlert className="h-3 w-3" /> Building coordinate — approximate
                      </Badge>
                    ) : selected.status === 'verified' ? (
                      <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                        <ShieldCheck className="h-3 w-3" /> Verified GPS location
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                        <TriangleAlert className="h-3 w-3" /> Unverified — approximate
                      </Badge>
                    )}
                    {selected.category === 'Smart School Wi-Fi' && (
                      <Badge className={selected.wifiStatus === 'maintenance' ? 'bg-amber-600 text-white' : 'bg-teal-700 text-white'}>
                        {selected.wifiStatus === 'maintenance' ? 'Under maintenance' : 'Available'}
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
              {selected.parentLocationId && (
                <p className="mt-2 text-xs text-muted-foreground">Sublocation of: {locations.find((loc) => loc.id === selected.parentLocationId)?.name ?? 'Campus facility'}</p>
              )}
              {locations.some((loc) => loc.parentLocationId === selected.id) && (
                <div className="mt-3 rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold">Sublocations</p>
                  <div className="space-y-2">
                    {locations.filter((loc) => loc.parentLocationId === selected.id).map((child) => (
                      <button key={child.id} type="button" onClick={() => selectLocation(child)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/60 p-2 text-left">
                        <span className="min-w-0"><span className="block truncate text-sm font-medium">{child.name}</span><span className="block text-[11px] text-muted-foreground">📶 Smart School Wi-Fi</span></span>
                        <Badge className={child.wifiStatus === 'maintenance' ? 'bg-amber-600 text-white' : 'bg-teal-700 text-white'}>{child.wifiStatus === 'maintenance' ? 'Maintenance' : 'Available'}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
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
                <Button variant="outline" size="sm" className="flex-1" disabled={routeLoading} onClick={() => { void buildRoute(selected) }}>
                  {routeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} Need direction
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

      <Dialog open={shareAfterLocateOpen} onOpenChange={setShareAfterLocateOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Share your location?</DialogTitle>
            <DialogDescription>Your current position is now shown on the EKSU map. Would you like to share this location with someone using an ALTECH EKSU Map link?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShareAfterLocateOpen(false)}>No, thanks</Button>
            <Button className="flex-1" onClick={shareLocatedPosition}><Share2 className="mr-2 h-4 w-4" />Yes, share</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sharedLocationNotice} onOpenChange={setSharedLocationNotice}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Shared location on EKSU Map</DialogTitle><DialogDescription>Someone shared this point with you. The orange marker shows the location on the ALTECH EKSU Campus Map.</DialogDescription></DialogHeader>
          <Button onClick={() => setSharedLocationNotice(false)}>View on map</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareUrl} onOpenChange={(open) => { if (!open) { setShareUrl(null); setShareError(null) } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Share your location</DialogTitle><DialogDescription>Scan this QR code or share the link to open your position directly in the ALTECH EKSU Campus Map.</DialogDescription></DialogHeader>
          {shareError ? <p className="text-sm text-destructive">{shareError}</p> : shareUrl && <div className="space-y-3">
            <div className="mx-auto flex w-fit rounded-xl border bg-white p-3"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`} alt="QR code for your location on the EKSU campus map" width="220" height="220" /></div>
            <p className="break-all rounded-lg bg-muted p-2 text-xs">{shareUrl}</p>
            <div className="flex gap-2"><Button className="flex-1" onClick={() => void shareLocationLink()}><Share2 className="mr-2 h-4 w-4" />Share link</Button><Button variant="outline" onClick={() => void navigator.clipboard.writeText(shareUrl)}>Copy</Button></div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={gatePromptOpen} onOpenChange={setGatePromptOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>You are not around the campus vicinity</DialogTitle>
            <DialogDescription>
              Would you like directions to an EKSU campus gate?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setGatePromptOpen(false)}>
              No
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setGatePromptOpen(false)
                setGatePickerOpen(true)
              }}
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={directionPickerOpen} onOpenChange={setDirectionPickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle>Where do you want to go?</DialogTitle><DialogDescription>Choose a saved campus location to see a walking route on this map.</DialogDescription></DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">{locations.filter((location) => location.geometryType === 'point').map((destination) => (<button key={destination.id} type="button" disabled={routeLoading} onClick={() => { void buildRoute(destination) }} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-muted disabled:opacity-50"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{destination.name}</span><span className="block text-xs text-muted-foreground">{destination.category}</span></span><Navigation className="h-4 w-4 shrink-0 text-primary" /></button>))}</div>
          {routeLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculating walking route…</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={gatePickerOpen} onOpenChange={setGatePickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Choose a campus gate</DialogTitle>
            <DialogDescription>
              Select a saved EKSU entrance to draw a walking route from your current location directly on this campus map.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {gateLocations.length > 0 ? gateLocations.map((gate) => (
              <button
                key={gate.id}
                type="button"
                onClick={() => openGateDirections(gate)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{gate.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {gate.lat.toFixed(6)}, {gate.lng.toFixed(6)}
                  </span>
                </span>
                <MapPinned className="h-5 w-5 shrink-0 text-primary" />
              </button>
            )) : (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                No campus gates have been saved yet. Add a location under “Entrances and gates” in the Admin dashboard.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    <ExpandableActionButton
      icon={children}
      label={label}
      onClick={onClick}
      active={active}
      className="bg-white/95"
    />
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
