'use client'

/**
 * MapPicker — admin coordinate-capture map.
 * Point mode:  tap to place the GPS marker.
 * Polygon:     tap to add outline vertices (building footprint).
 * Polyline:    tap to add path vertices (roads / walking pathways).
 * Uses the real WGS84 coordinates captured — stored and exported verbatim.
 */
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polygon, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { EKSU_CAMPUS_CENTER } from '@/lib/geo'

export type PickerMode = 'point' | 'polygon' | 'polyline'

export type MapPickerProps = {
  mode: PickerMode
  point: { lat: number; lng: number } | null
  vertices: [number, number][] // [[lng,lat], ...] original order preserved
  onPointChange: (lat: number, lng: number) => void
  onAddVertex: (lat: number, lng: number) => void
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="eksu-pin" style="--marker-c:#0f766e"><span>📍</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 40],
})

const vertexIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#0f766e;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.5)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

function Tapper({ mode, onPointChange, onAddVertex }: Omit<MapPickerProps, 'point' | 'vertices'>) {
  useMapEvents({
    click(e) {
      if (mode === 'point') onPointChange(e.latlng.lat, e.latlng.lng)
      else onAddVertex(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true })
  }, [lat, lng, map])
  return null
}

export default function MapPicker({ mode, point, vertices, onPointChange, onAddVertex }: MapPickerProps) {
  const latlngs = useMemo(() => vertices.map(([lng, lat]) => [lat, lng] as [number, number]), [vertices])
  const center: [number, number] = point
    ? [point.lat, point.lng]
    : vertices.length > 0
      ? latlngs[Math.floor(latlngs.length / 2)]
      : [EKSU_CAMPUS_CENTER.lat, EKSU_CAMPUS_CENTER.lng]

  return (
    <div className="h-72 w-full overflow-hidden rounded-lg border md:h-80">
      <MapContainer
        center={center}
        zoom={17}
        minZoom={12}
        maxZoom={20}
        zoomControl={true}
        className="relative z-0 h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; OpenStreetMap contributors'
        />
        <Tapper mode={mode} onPointChange={onPointChange} onAddVertex={onAddVertex} />
        {mode === 'point' ? (
          point ? (
            <>
              <Marker position={[point.lat, point.lng]} icon={pinIcon} />
              <Recenter lat={point.lat} lng={point.lng} />
            </>
          ) : null
        ) : (
          <>
            {mode === 'polygon' && latlngs.length >= 3 && (
              <Polygon positions={latlngs} pathOptions={{ color: '#0f766e', weight: 2, fillColor: '#0d9488', fillOpacity: 0.25 }} />
            )}
            {mode === 'polyline' && latlngs.length >= 2 && (
              <Polyline positions={latlngs} pathOptions={{ color: '#0f766e', weight: 5, lineCap: 'round' }} />
            )}
            {vertices.map(([lng, lat], i) => (
              <Marker key={`${i}-${lng}-${lat}`} position={[lat, lng]} icon={vertexIcon}>
                <Tooltip direction="top" offset={[0, -8]}>Vertex {i + 1}</Tooltip>
              </Marker>
            ))}
            {vertices.length > 0 && (
              <CircleMarker
                center={latlngs[latlngs.length - 1]}
                radius={10}
                pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0 }}
                interactive={false}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  )
}
