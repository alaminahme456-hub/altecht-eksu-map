'use client'

import { useEffect, useState } from 'react'
import CampusMapApp from '@/components/CampusMapApp'
import AdminApp from '@/components/admin/AdminApp'

/**
 * Single-page application root.
 * The preview gateway only exposes `/`, so the map view and the admin
 * dashboard live under the same route and switch via the URL hash:
 *   #/        → public campus map
 *   #/admin   → administrator data-collection dashboard
 */
export default function Home() {
  const [route, setRoute] = useState<'map' | 'admin'>('map')

  useEffect(() => {
    const sync = () =>
      setRoute(window.location.hash.startsWith('#/admin') ? 'admin' : 'map')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return route === 'admin' ? <AdminApp /> : <CampusMapApp />
}
