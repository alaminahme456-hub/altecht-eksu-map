'use client'

import { useEffect } from 'react'

/**
 * Keeps a lightweight history entry while the campus map is open.
 * A device/browser Back action returns the user to the main map instead
 * of navigating away from the app.
 */
export default function MapBackHandler({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    const pushMapEntry = () => {
      window.history.pushState({ eksuMapRoot: true }, '', window.location.href)
    }

    pushMapEntry()

    const handlePopState = () => {
      onBack()
      // Keep the map as the active page after handling the device Back action.
      pushMapEntry()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [onBack])

  return null
}
