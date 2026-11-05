'use client'

/**
 * AdminApp — administrator campus-data-collection dashboard (login-guarded).
 * Tabs: Locations (CRUD + verify) · Data quality · Import / Export.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Camera,
  Database,
  Loader2,
  LogOut,
  MapPinned,
  Map as MapIcon,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { CATEGORIES, categoryMeta } from '@/lib/categories'
import type { LocationDTO, QualityReport } from '@/lib/types'
import LocationForm from '@/components/admin/LocationForm'
import QualityPanel from '@/components/admin/QualityPanel'
import ImportExportPanel from '@/components/admin/ImportExportPanel'

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [locations, setLocations] = useState<LocationDTO[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [qualityLoading, setQualityLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [formEditing, setFormEditing] = useState<LocationDTO | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LocationDTO | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadLocations = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/locations', { cache: 'no-store' })
      const data = (await res.json()) as { locations: LocationDTO[] }
      setLocations(data.locations ?? [])
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadQuality = useCallback(async () => {
    setQualityLoading(true)
    try {
      const res = await fetch('/api/quality', { cache: 'no-store' })
      if (res.ok) setQuality((await res.json()) as QualityReport)
    } finally {
      setQualityLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = (await res.json()) as { admin: boolean }
        setAuthed(data.admin)
      } catch {
        setAuthed(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (authed) {
      void loadLocations()
      void loadQuality()
    }
  }, [authed, loadLocations, loadQuality])

  const login = async () => {
    setLoginBusy(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setAuthed(true)
      setPassword('')
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoginBusy(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthed(false)
  }

  const toggleVerify = async (loc: LocationDTO) => {
    const next = loc.status === 'verified' ? 'draft' : 'verified'
    const res = await fetch(`/api/locations/${loc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      setNotice(next === 'verified'
        ? `“${loc.name}” marked as VERIFIED GPS data.`
        : `“${loc.name}” returned to UNVERIFIED draft.`)
      void loadLocations()
      void loadQuality()
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/locations/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setNotice(`Deleted “${deleteTarget.name}”.`)
      setDeleteTarget(null)
      void loadLocations()
      void loadQuality()
    }
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    return locations.filter((l) => {
      if (catFilter !== 'all' && l.category !== catFilter) return false
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (q && !(l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q))) return false
      return true
    })
  }, [locations, search, catFilter, statusFilter])

  // ---------------- Login screen ----------------
  if (authed === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f5f5f4] p-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white">
              <MapPinned className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-bold leading-tight">ALTECH EKSU Campus Map</h1>
              <p className="text-xs text-muted-foreground">Administrator sign-in</p>
            </div>
          </div>
          {loginError && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">{loginError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <label htmlFor="admin-pass" className="text-sm font-medium">Administrator password</label>
            <Input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void login()}
              placeholder="Enter password"
              autoFocus
            />
          </div>
          <Button className="w-full" onClick={login} disabled={loginBusy || password.length === 0}>
            {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Sign in
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => (window.location.hash = '')}>
            <MapIcon className="h-4 w-4" /> Back to the public map
          </Button>
        </div>
      </div>
    )
  }

  // ---------------- Dashboard ----------------
  return (
    <div className="min-h-[100dvh] bg-[#f5f5f4]">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white">
            <MapPinned className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold leading-tight">Campus Data Collection Dashboard</h1>
            <p className="truncate text-[11px] text-muted-foreground">ALTECH EKSU interactive map · administrator</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => (window.location.hash = '')}>
            <MapIcon className="h-4 w-4" /> Map
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {notice && (
          <Alert className="mb-4 border-emerald-300 bg-emerald-50 text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="flex items-start justify-between gap-2 text-xs">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
            </AlertDescription>
          </Alert>
        )}

        {formOpen ? (
          <LocationForm
            editing={formEditing}
            onCancel={() => {
              setFormOpen(false)
              setFormEditing(null)
            }}
            onSaved={(loc, warnings) => {
              setFormOpen(false)
              setFormEditing(null)
              setNotice(
                warnings.length > 0
                  ? `Saved “${loc.name}”. Attention: ${warnings.join(' · ')}`
                  : `Saved “${loc.name}”. It is now visible on the public map — no rebuild needed.`
              )
              void loadLocations()
              void loadQuality()
            }}
          />
        ) : (
          <Tabs defaultValue="locations" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setFormEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Add location
              </Button>
              <TabsList className="ml-auto">
                <TabsTrigger value="locations" className="text-xs">Locations</TabsTrigger>
                <TabsTrigger value="quality" className="text-xs">
                  Data quality
                  {quality && quality.duplicates.length + quality.suspicious.length > 0 && (
                    <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[9px]">
                      {quality.duplicates.length + quality.suspicious.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="data" className="text-xs">Import / Export</TabsTrigger>
              </TabsList>
            </div>

            {/* ------- Locations tab ------- */}
            <TabsContent value="locations" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter records…" className="pl-8" />
                </div>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="w-44" aria-label="Filter by category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="draft">Unverified draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {listLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredList.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  No records match the current filters.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {filteredList.map((l) => {
                    const meta = categoryMeta(l.category)
                    return (
                      <div key={l.id} className="rounded-xl border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{l.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="px-1.5 text-[10px] text-white" style={{ backgroundColor: meta.color }}>
                                {meta.icon} {l.category}
                              </Badge>
                              {l.geometryType !== 'point' && (
                                <Badge variant="outline" className="text-[9px] uppercase">{l.geometryType}</Badge>
                              )}
                              {l.source === 'sample' && (
                                <Badge variant="outline" className="text-[9px] uppercase text-stone-500">sample</Badge>
                              )}
                            </div>
                          </div>
                          {l.status === 'verified' ? (
                            <Badge className="shrink-0 gap-1 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                              <ShieldCheck className="h-3 w-3" /> Verified
                            </Badge>
                          ) : (
                            <Badge className="shrink-0 gap-1 bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                              <TriangleAlert className="h-3 w-3" /> Unverified
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                          {l.lat.toFixed(6)}, {l.lng.toFixed(6)}
                          {l.coordinates ? ` · ${l.coordinates.length} vertices` : ''}
                          {l.photos.length > 0 && ` · ${l.photos.length} photo${l.photos.length > 1 ? 's' : ''}`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => toggleVerify(l)}>
                            {l.status === 'verified' ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                            {l.status === 'verified' ? 'Unverify' : 'Verify'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => {
                              setFormEditing(l)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-red-700 hover:text-red-800" onClick={() => setDeleteTarget(l)}>
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ------- Quality tab ------- */}
            <TabsContent value="quality">
              <QualityPanel
                report={quality}
                loading={qualityLoading}
                onRefresh={() => void loadQuality()}
                onEdit={(id) => {
                  const loc = locations.find((l) => l.id === id)
                  if (loc) {
                    setFormEditing(loc)
                    setFormOpen(true)
                  }
                }}
              />
            </TabsContent>

            {/* ------- Import / Export tab ------- */}
            <TabsContent value="data">
              <ImportExportPanel featureCount={locations.length} onChanged={() => { void loadLocations(); void loadQuality() }} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the record{deleteTarget && deleteTarget.photos.length > 0 ? ' and its photographs' : ''} from
              the map and all future GeoJSON exports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={doDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
