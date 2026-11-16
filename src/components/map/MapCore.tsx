'use client'

/**
 * MapCore — the actual Leaflet map (client-only, dynamically imported).
 * Renders on OpenStreetMap raster tiles with a clean "illustrated" CARTO
 * Voyager basemap option. Every feature is placed at its REAL stored
 * coordinates — nothing is positioned arbitrarily.
 */
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  Circle,
  Tooltip,
  ScaleControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { categoryMeta } from '@/lib/categories'
import { EKSU_CAMPUS_CENTER, formatDistance, pathLengthMeters } from '@/lib/geo'
import type { LocationDTO } from '@/lib/types'

export type FlyTarget = { lat: number; lng: number; zoom?: number; key: number } | null
export type UserPos = { lat: number; lng: number; accuracy: number } | null

export type MapCoreProps = {
  locations: LocationDTO[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  userPos: UserPos
  sharedLocation: { lat: number; lng: number } | null
  routeCoordinates: [number, number][]
  basemap: 'illustrated' | 'osm'
  flyTarget: FlyTarget
  onMapReady?: (map: L.Map) => void
}

function markerIcon(loc: LocationDTO, selected: boolean): L.DivIcon {
  const meta = categoryMeta(loc.category)
  const isWifi = loc.category === 'Smart School Wi-Fi'
  if (isWifi) {
    const statusColor = loc.wifiStatus === 'maintenance' ? '#d97706' : '#16a34a'
    return L.divIcon({
      className: '',
      html: `<div class="eksu-wifi-marker${selected ? ' is-selected' : ''}" style="--wifi-marker-c:${statusColor}" title="${escapeLabel(loc.name)}"><span>📶</span></div>`,
      iconSize: [20, 20],
      // Keep the stored coordinates unchanged; visually place the small Wi-Fi marker beside its parent pin.
      iconAnchor: [-10, 10],
    })
  }
  const cls = [
    'eksu-marker',
    loc.status === 'draft' ? 'is-draft' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return L.divIcon({
    className: '',
    html: `<div class="${cls}" style="--marker-c:${meta.color}" title="${escapeLabel(loc.name)}"><span>${meta.icon}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

const sharedLocationIcon = L.divIcon({
  className: '',
  html: '<div style="width:24px;height:24px;border:3px solid white;border-radius:50%;background:#f97316;box-shadow:0 1px 8px #0008;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:800">★</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const userIcon = L.divIcon({
  className: '',
  html: '<div class="user-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function FlyController({ target }: { target: FlyTarget }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom ?? Math.max(map.getZoom(), 17), {
        duration: 0.8,
      })
    }
  }, [target, map])
  return null
}

function ClickHandler({ onSelect }: { onSelect: (id: null) => void }) {
  useMapEvents({ click() { onSelect(null) } })
  return null
}


function escapeLabel(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}

/** Shows as many nearby place names as fit without covering one another. */
function LocationLabels({
  locations,
  selectedId,
}: {
  locations: LocationDTO[]
  selectedId: string | null
}) {
  const map = useMap()
  const [visibleIds, setVisibleIds] = useState<string[]>([])

  useEffect(() => {
    const update = () => {
      if (map.getZoom() < 16) {
        setVisibleIds(selectedId ? [selectedId] : [])
        return
      }
      const bounds = map.getBounds()
      const candidates = locations
        .filter((loc) => bounds.contains([loc.lat, loc.lng]) && (loc.category !== 'Smart School Wi-Fi' || loc.id === selectedId))
        .map((loc) => {
          const point = map.latLngToContainerPoint([loc.lat, loc.lng])
          const width = Math.min(190, Math.max(58, loc.name.length * 6.8 + 18))
          return { id: loc.id, x: point.x + 20, y: point.y - 12, width, height: 26 }
        })
        .sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0))

      const accepted: typeof candidates = []
      for (const item of candidates) {
        const overlaps = accepted.some((other) =>
          item.x < other.x + other.width + 8 &&
          item.x + item.width + 8 > other.x &&
          item.y < other.y + other.height + 5 &&
          item.y + item.height + 5 > other.y
        )
        if (!overlaps || item.id === selectedId) accepted.push(item)
      }
      setVisibleIds(accepted.map((item) => item.id))
    }

    update()
    map.on('moveend zoomend', update)
    return () => { map.off('moveend zoomend', update) }
  }, [locations, map, selectedId])

  return (
    <>
      {locations.filter((loc) => visibleIds.includes(loc.id)).map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          interactive={false}
          icon={L.divIcon({
            className: 'eksu-location-label-icon',
            html: `<span class="eksu-location-label">${escapeLabel(loc.name)}</span>`,
            iconSize: [0, 0],
            iconAnchor: [-20, 12],
          })}
        />
      ))}
    </>
  )
}

function RouteViewport({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coordinates.length >= 2) {
      map.fitBounds(coordinates, { padding: [70, 70], maxZoom: 18, animate: true })
    }
  }, [coordinates, map])
  return null
}

export default function MapCore({
  locations,
  selectedId,
  onSelect,
  userPos,
  sharedLocation,
  routeCoordinates,
  basemap,
  flyTarget,
  onMapReady,
}: MapCoreProps) {
  const points = useMemo(
    () => locations.filter((l) => l.geometryType === 'point'),
    [locations]
  )
  const polygons = useMemo(
    () => locations.filter((l) => l.geometryType === 'polygon' && l.coordinates && l.coordinates.length >= 3),
    [locations]
  )
  const lines = useMemo(
    () => locations.filter((l) => l.geometryType === 'polyline' && l.coordinates && l.coordinates.length >= 2),
    [locations]
  )

  const handleFeatureClick = (id: string) => onSelect(id)

  return (
    <MapContainer
      center={[EKSU_CAMPUS_CENTER.lat, EKSU_CAMPUS_CENTER.lng]}
      zoom={16}
      minZoom={12}
      maxZoom={20}
      zoomControl={false}
      className="relative z-0 h-full w-full"
      ref={(m) => {
        if (m && onMapReady) onMapReady(m)
      }}
    >
      {basemap === 'illustrated' ? (
        <TileLayer
          key="voyager"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        />
      ) : (
        <TileLayer
          key="osm"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
      )}

      <ScaleControl position="bottomright" imperial={false} />
      <FlyController target={flyTarget} />
      <ClickHandler onSelect={onSelect} />
      <RouteViewport coordinates={routeCoordinates} />
      <LocationLabels locations={points} selectedId={selectedId} />

      {/* Approximate campus envelope — orientation aid, NOT a surveyed boundary */}
      <Circle
        center={[EKSU_CAMPUS_CENTER.lat, EKSU_CAMPUS_CENTER.lng]}
        radius={1200}
        interactive={false}
        pathOptions={{
          color: '#78716c',
          weight: 1.5,
          dashArray: '6 8',
          fill: true,
          fillColor: '#a8a29e',
          fillOpacity: 0.04,
        }}
      />

      {/* Roads and walking pathways (polylines) */}
      {lines.map((l) => {
        const meta = categoryMeta(l.category)
        const len = pathLengthMeters(l.coordinates!)
        return (
          <Polyline
            key={l.id}
            positions={l.coordinates!.map(([lng, lat]) => [lat, lng] as [number, number])}
            eventHandlers={{ click: () => handleFeatureClick(l.id) }}
            pathOptions={{
              color: meta.color,
              weight: selectedId === l.id ? 7 : 5,
              opacity: 0.85,
              dashArray: l.status === 'draft' ? '10 8' : undefined,
              lineCap: 'round',
            }}
          >
            <Tooltip sticky className="eksu-tip">
              {l.name} · {formatDistance(len)}
              {l.status === 'draft' ? ' · unverified' : ''}
            </Tooltip>
          </Polyline>
        )
      })}

      {/* Building outlines (polygons) */}
      {polygons.map((l) => {
        const meta = categoryMeta(l.category)
        return (
          <Polygon
            key={l.id}
            positions={l.coordinates!.map(([lng, lat]) => [lat, lng] as [number, number])}
            eventHandlers={{ click: () => handleFeatureClick(l.id) }}
            pathOptions={{
              color: meta.color,
              weight: selectedId === l.id ? 3.5 : 2,
              dashArray: l.status === 'draft' ? '5 5' : undefined,
              fillColor: meta.color,
              fillOpacity: 0.22,
            }}
          >
            <Tooltip sticky className="eksu-tip">
              {l.name}
              {l.status === 'draft' ? ' · unverified' : ''}
            </Tooltip>
          </Polygon>
        )
      })}

      {/* Building / facility markers at their GPS coordinates */}
      {points.map((l) => (
        <Marker
          key={l.id}
          position={[l.lat, l.lng]}
          icon={markerIcon(l, selectedId === l.id)}
          zIndexOffset={selectedId === l.id ? 1000 : 0}
          eventHandlers={{ click: () => handleFeatureClick(l.id) }}
        >
          <Tooltip direction="top" offset={[0, -18]} className="eksu-tip">
            {l.name}
            {l.status === 'draft' ? ' · unverified' : ''}
          </Tooltip>
        </Marker>
      ))}

      {/* Location shared through an ALTECH EKSU Map link */}
      {sharedLocation && (
        <Marker position={[sharedLocation.lat, sharedLocation.lng]} icon={sharedLocationIcon} interactive={false}>
          <Tooltip direction="top" offset={[0, -12]} permanent className="eksu-tip">Shared location</Tooltip>
        </Marker>
      )}

      {/* User location */}
      {userPos && (
        <>
          <Circle
            center={[userPos.lat, userPos.lng]}
            radius={Math.max(userPos.accuracy, 12)}
            interactive={false}
            pathOptions={{ color: '#0d9488', weight: 1, fillOpacity: 0.12 }}
          />
          <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} interactive={false}>
            <Tooltip direction="top" offset={[0, -10]} className="eksu-tip">
              You are here (±{Math.round(userPos.accuracy)} m)
            </Tooltip>
          </Marker>
        </>
      )}

      {/* Pedestrian route snapped to mapped roads and footpaths */}
      {routeCoordinates.length >= 2 && <Polyline positions={routeCoordinates} interactive={false} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }} />}
    </MapContainer>
  )
}
