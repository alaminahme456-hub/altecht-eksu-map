'use client'

/**
 * PhotoUploader — photographs are uploaded straight into the application
 * (stored under /public/uploads, referenced from the Location record).
 * - Existing record: each picked file uploads immediately.
 * - New record: files are staged and uploaded right after the record is saved.
 */
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Camera, Trash2 } from 'lucide-react'
import type { PhotoDTO } from '@/lib/types'

export default function PhotoUploader({
  existing,
  staged,
  uploading,
  onPick,
  onRemoveStaged,
  onDeleteExisting,
}: {
  existing: PhotoDTO[]
  staged: { name: string; url: string }[]
  uploading: boolean
  onPick: (files: File[]) => void
  onRemoveStaged: (name: string) => void
  onDeleteExisting?: (photoId: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onPick(files)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {uploading ? 'Uploading…' : 'Add photographs (JPG, PNG, WebP · max 8 MB)'}
      </Button>

      {(existing.length > 0 || staged.length > 0) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {existing.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border">
              <img src={p.filename} alt="Uploaded campus photograph" className="h-20 w-full object-cover" />
              {onDeleteExisting && (
                <button
                  type="button"
                  onClick={() => onDeleteExisting(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700"
                  aria-label="Delete photograph"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {staged.map((s) => (
            <div key={s.name} className="group relative overflow-hidden rounded-lg border border-dashed border-emerald-600">
              <img src={s.url} alt={`Staged photograph ${s.name}`} className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveStaged(s.name)}
                className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700"
                aria-label="Remove staged photograph"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {staged.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {staged.length} photo(s) will be uploaded when you save this record.
        </p>
      )}
    </div>
  )
}
