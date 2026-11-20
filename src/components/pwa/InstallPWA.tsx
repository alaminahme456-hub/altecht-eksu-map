'use client'

import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function InstallPWA() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
          console.error('PWA service worker registration failed:', error)
        })
      }, { once: true })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!promptEvent) {
      setHelpOpen((open) => !open)
      return
    }
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  if (installed) return null

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={install}
        aria-label="Install EKSU Smart Campus"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-teal-700/20 bg-teal-50 px-2.5 text-xs font-semibold text-teal-800 shadow-sm hover:bg-teal-100"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">App</span>
      </button>
      {helpOpen && !promptEvent && (
        <div className="absolute right-0 top-11 z-[10000] w-64 rounded-xl border bg-white p-3 text-xs text-stone-700 shadow-xl">
          <div className="mb-1 flex items-center gap-2 font-bold text-stone-900">
            <Share className="h-4 w-4" /> Add to your home screen
          </div>
          <p className="leading-relaxed">
            In your browser menu, choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            On iPhone Safari, tap Share, then Add to Home Screen.
          </p>
          <button className="mt-2 font-semibold text-teal-800" onClick={() => setHelpOpen(false)}>Close</button>
        </div>
      )}
    </div>
  )
}
