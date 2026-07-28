'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Calendar, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LABELS } from '@/lib/consts'

export type HistoryLessonCardProps = {
  lessonId: string
  title: string
  sourceType: string
  createdAtLabel: string
}

export function HistoryLessonCard({
  lessonId,
  title,
  sourceType,
  createdAtLabel,
}: HistoryLessonCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!window.confirm(LABELS.HISTORY_DELETE_CONFIRM)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setDeleteError(body?.error ?? LABELS.HISTORY_DELETE_ERROR)
        return
      }
      router.refresh()
    } catch {
      setDeleteError(LABELS.HISTORY_DELETE_ERROR)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="border-2 border-[#C5CBE3] bg-white transition-colors hover:border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/learn/${lessonId}`} className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#D79922]/20">
                <Sparkles className="h-6 w-6 text-[#D79922]" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-foreground">{title}</h3>
                <p className="text-sm capitalize text-muted-foreground">{sourceType}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {createdAtLabel}
                </p>
                {deleteError ? (
                  <p className="mt-1 text-xs text-destructive">{deleteError}</p>
                ) : null}
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label={LABELS.HISTORY_DELETE_ARIA}
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/learn/${lessonId}`} aria-label={LABELS.HISTORY_OPEN}>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
