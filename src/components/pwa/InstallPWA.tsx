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
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const userAgent = window.navigator.userAgent
    const platform = window.navigator.platform
    const ios = /iPad|iPhone|iPod/.test(userAgent) ||
      (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    setIsIOS(ios)

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
      setHelpOpen(false)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.error('PWA service worker registration failed:', error)
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (isIOS || !promptEvent) {
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
        aria-expanded={helpOpen}
        aria-label={isIOS ? 'How to add EKSU Map to your iPhone home screen' : 'Install EKSU Map'}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-teal-700/20 bg-teal-50 px-2.5 text-xs font-semibold text-teal-800 shadow-sm hover:bg-teal-100 active:bg-teal-200"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{isIOS ? 'Add to Home Screen' : 'Install App'}</span>
        <span className="sm:hidden">{isIOS ? 'Add' : 'App'}</span>
      </button>
      {helpOpen && (
        <div
          role="dialog"
          aria-label="Install EKSU Map"
          className="absolute right-0 top-11 z-[10000] w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-3 text-xs text-stone-700 shadow-xl"
        >
          <div className="mb-1 flex items-center gap-2 font-bold text-stone-900">
            <Share className="h-4 w-4" /> Add EKSU Map to your Home Screen
          </div>
          {isIOS ? (
            <ol className="list-decimal space-y-1.5 pl-4 leading-relaxed">
              <li>Open this page in <strong>Safari</strong> on your iPhone.</li>
              <li>Tap the <strong>Share</strong> button at the bottom of Safari (or at the top on some iPads).</li>
              <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
              <li>Keep the name <strong>EKSU Map</strong>, then tap <strong>Add</strong>.</li>
            </ol>
          ) : (
            <p className="leading-relaxed">
              Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </p>
          )}
          <button
            className="mt-3 rounded-md px-2 py-1 font-semibold text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
            onClick={() => setHelpOpen(false)}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
