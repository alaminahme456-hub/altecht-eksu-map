'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MessageCircle, Send, Users, Eye, EyeOff, Trash2 } from 'lucide-react'
import SurveyPanel from '@/components/map/SurveyPanel'
import ExpandableActionButton from '@/components/ui/expandable-action-button'

type GeneralComment = { id: string; body: string; isVisible: boolean; createdAt: string }

export default function CommunityPanel() {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<GeneralComment[]>([])
  const [admin, setAdmin] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refreshComments = useCallback(async () => {
    try {
      const response = await fetch('/api/community/comments', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load comments')
      setComments(data.comments || [])
      setAdmin(!!data.admin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load comments')
    }
  }, [])

  useEffect(() => {
    void refreshComments()
  }, [refreshComments])

  const submitComment = async () => {
    const comment = draft.trim()
    if (!comment || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not submit comment')
      setDraft('')
      await refreshComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit comment')
    } finally {
      setBusy(false)
    }
  }

  const moderate = async (comment: GeneralComment, action: 'hide' | 'show' | 'delete') => {
    if (action === 'delete' && !window.confirm('Permanently delete this comment?')) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        action === 'delete' ? '/api/community/comments?id=' + encodeURIComponent(comment.id) : '/api/community/comments',
        {
          method: action === 'delete' ? 'DELETE' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          ...(action === 'delete' ? {} : { body: JSON.stringify({ id: comment.id, isVisible: action === 'show' }) }),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not moderate comment')
      await refreshComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not moderate comment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative">
        <ExpandableActionButton
          icon={<Users className="h-4 w-4" />}
          label="Community"
          onClick={() => setOpen(true)}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88dvh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> EKSU Map Community</DialogTitle>
            <DialogDescription>Take part in campus surveys and share feedback about the map, locations and facilities.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <section className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4" /> General comments</h3>
                <Badge variant="secondary">{comments.length} shown</Badge>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Leave a suggestion, report an incorrect map location, or share feedback. These comments are not tied to a survey.</p>
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} rows={3} placeholder="Write your feedback or suggestion…" />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{draft.length}/500 · Up to 3 comments per hour per browser</span>
                <Button size="sm" disabled={!draft.trim() || busy} onClick={() => void submitComment()}><Send className="mr-1.5 h-3.5 w-3.5" /> Post comment</Button>
              </div>
              {error && <p role="alert" className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>}
              <div className="mt-3 space-y-2">
                {comments.length === 0 ? (
                  <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">No general comments yet. Be the first to share feedback.</p>
                ) : comments.map((comment) => (
                  <article key={comment.id} className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-xs">{comment.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}{!comment.isVisible ? ' · Hidden from students' : ''}</p>
                    </div>
                    {admin && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => void moderate(comment, comment.isVisible ? 'hide' : 'show')} aria-label={comment.isVisible ? 'Hide comment' : 'Show comment'}>
                          {comment.isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={busy} onClick={() => void moderate(comment, 'delete')} aria-label="Delete comment">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Comments are public after posting. Do not include phone numbers, private details or abusive content. Admins can hide or delete comments.</p>
            </section>

            <section className="rounded-xl border p-3">
              <h3 className="mb-1 text-sm font-bold">Campus surveys</h3>
              <p className="mb-2 text-xs text-muted-foreground">Vote on questions published by the EKSU Map administrators.</p>
              <SurveyPanel />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
