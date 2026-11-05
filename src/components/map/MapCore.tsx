'use client'

/**
 * MapCore — the actual Leaflet map (client-only, dynamically imported).
 * Renders on OpenStreetMap raster tiles with a clean "illustrated" CARTO
 * Voyager basemap option. Every feature is placed at its REAL stored
 * coordinates — nothing is positioned arbitrarily.
 */
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
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
  measureMode: boolean
  measurePoints: { lat: number; lng: number }[]
  onMeasurePoint: (lat: number, lng: number) => void
  basemap: 'illustrated' | 'osm'
  flyTarget: FlyTarget
  onMapReady?: (map: L.Map) => void
}

function markerIcon(loc: LocationDTO, selected: boolean): L.DivIcon {
  const meta = categoryMeta(loc.category)
  const cls = [
    'eksu-marker',
    loc.status === 'draft' ? 'is-draft' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return L.divIcon({
    className: '',
    html: `<div class="${cls}" style="--marker-c:${meta.color}" title="${loc.name.replace(/"/g, '&quot;')}"><span>${meta.icon}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

const userIcon = L.divIcon({
  className: '',
  html: '<div class="user-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const measureDot = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
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

function ClickHandler({
  measureMode,
  onMeasurePoint,
  onSelect,
}: {
  measureMode: boolean
  onMeasurePoint: (lat: number, lng: number) => void
  onSelect: (id: null) => void
}) {
  useMapEvents({
    click(e) {
      if (measureMode) {
        onMeasurePoint(e.latlng.lat, e.latlng.lng)
      } else {
        onSelect(null)
      }
    },
  })
  return null
}

export default function MapCore({
  locations,
  selectedId,
  onSelect,
  userPos,
  measureMode,
  measurePoints,
  onMeasurePoint,
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

  const handleFeatureClick = (id: string) => {
    if (measureMode) {
      const loc = locations.find((l) => l.id === id)
      if (loc) onMeasurePoint(loc.lat, loc.lng)
    } else {
      onSelect(id)
    }
  }

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
      <ClickHandler measureMode={measureMode} onMeasurePoint={onMeasurePoint} onSelect={onSelect} />

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

      {/* Measure points + connecting dashed line */}
      {measurePoints.map((p, i) => (
        <Marker key={`m${i}`} position={[p.lat, p.lng]} icon={measureDot} interactive={false} />
      ))}
      {measurePoints.length >= 2 && (
        <Polyline
          positions={measurePoints.map((q) => [q.lat, q.lng] as [number, number])}
          interactive={false}
          pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '2 6' }}
        />
      )}
    </MapContainer>
  )
}
