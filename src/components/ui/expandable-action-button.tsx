'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ExpandableActionButtonProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  autoCollapseMs?: number
}

export default function ExpandableActionButton({
  icon,
  label,
  onClick,
  active = false,
  className,
  variant = 'outline',
  size = 'sm',
  autoCollapseMs = 1800,
}: ExpandableActionButtonProps) {
  const [expanded, setExpanded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const collapseLater = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setExpanded(false), autoCollapseMs)
  }, [autoCollapseMs])

  const expand = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setExpanded(true)
    collapseLater()
  }, [collapseLater])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      onClick={() => {
        expand()
        onClick()
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') expand()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') collapseLater()
      }}
      onFocus={expand}
      onBlur={collapseLater}
      className={cn(
        'group inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border bg-white/95 px-0 shadow-md backdrop-blur transition-[width,padding,background-color,color,border-radius] duration-300 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50',
        expanded && 'w-auto min-w-10 rounded-full px-3',
        active && 'border-stone-900 bg-stone-900 text-white hover:bg-stone-800',
        className,
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className={cn(
        'max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-[max-width,opacity] duration-300',
        expanded && 'max-w-40 opacity-100',
      )}>{label}</span>
    </Button>
  )
}
