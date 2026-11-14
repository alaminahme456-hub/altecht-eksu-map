import { haversineMeters } from '@/lib/geo'
import type { LocationDTO } from '@/lib/types'

type Node = { lat: number; lng: number; edges: Map<number, number> }

/**
 * Route over administrator-recorded campus walkways.
 * Each saved polyline contributes its real vertices and segment lengths.
 * Path endpoints within 15m are treated as the same junction.
 */
export function routeOnRecordedPaths(
  locations: LocationDTO[],
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): { coordinates: [number, number][]; distance: number } | null {
  const paths = locations.filter(
    (l) => l.geometryType === 'polyline' && l.coordinates && l.coordinates.length >= 2
  )
  if (!paths.length) return null

  const nodes: Node[] = []
  const pathNodeIds: number[][] = []
  const addNode = (lng: number, lat: number) => {
    const id = nodes.length
    nodes.push({ lat, lng, edges: new Map() })
    return id
  }
  const addEdge = (a: number, b: number) => {
    const distance = haversineMeters(nodes[a].lat, nodes[a].lng, nodes[b].lat, nodes[b].lng)
    if (distance > 0) {
      nodes[a].edges.set(b, distance)
      nodes[b].edges.set(a, distance)
    }
  }

  for (const path of paths) {
    const ids = path.coordinates!.map(([lng, lat]) => addNode(lng, lat))
    pathNodeIds.push(ids)
    for (let i = 1; i < ids.length; i++) addEdge(ids[i - 1], ids[i])
  }

  // Connect only walkway ends, avoiding accidental links between nearby parallel paths.
  const endpoints: number[] = []
  for (const ids of pathNodeIds) endpoints.push(ids[0], ids[ids.length - 1])
  const parent = nodes.map((_, i) => i)
  const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]))
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const a = endpoints[i], b = endpoints[j]
      if (find(a) !== find(b) && haversineMeters(nodes[a].lat, nodes[a].lng, nodes[b].lat, nodes[b].lng) <= 15) {
        parent[find(a)] = find(b)
        addEdge(a, b)
      }
    }
  }

  const nearestNode = (point: { lat: number; lng: number }) => {
    let best = -1, bestDistance = Infinity
    nodes.forEach((node, i) => {
      const d = haversineMeters(point.lat, point.lng, node.lat, node.lng)
      if (d < bestDistance) { best = i; bestDistance = d }
    })
    return bestDistance <= 90 ? best : -1
  }
  const start = nearestNode(origin)
  const finish = nearestNode(destination)
  if (start < 0 || finish < 0) return null

  const distances = new Array(nodes.length).fill(Infinity) as number[]
  const previous = new Array(nodes.length).fill(-1) as number[]
  const visited = new Set<number>()
  distances[start] = 0

  while (visited.size < nodes.length) {
    let current = -1, best = Infinity
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && distances[i] < best) { current = i; best = distances[i] }
    }
    if (current < 0 || current === finish) break
    visited.add(current)
    for (const [next, weight] of nodes[current].edges) {
      const candidate = best + weight
      if (candidate < distances[next]) { distances[next] = candidate; previous[next] = current }
    }
  }
  if (!Number.isFinite(distances[finish])) return null
  const route: number[] = []
  for (let at = finish; at !== -1; at = previous[at]) {
    route.push(at)
    if (at === start) break
  }
  if (route[route.length - 1] !== start) return null
  route.reverse()
  return {
    coordinates: route.map((id) => [nodes[id].lat, nodes[id].lng]),
    distance: distances[finish],
  }
}
