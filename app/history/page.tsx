import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { HistoryLessonCard } from '@/components/history-lesson-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LABELS } from '@/lib/consts'
import { getCurrentUserId } from '@/src/auth/session'
import { listLessons } from '@/src/db/lessons'
import { createServiceRoleClient } from '@/src/db/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HistoryPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login')

  const lessonsList = await listLessons(createServiceRoleClient(), userId, 50)

  return (
    <AppShell active="history">
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 font-serif text-3xl font-bold text-primary">
              {LABELS.NAV_HISTORY_TESTS}
            </h1>
            <p className="text-muted-foreground">{LABELS.HISTORY_SUBTITLE}</p>
          </div>
          <Button asChild>
            <Link href="/">
              <Plus className="h-4 w-4" />
              {LABELS.HISTORY_NEW_LESSON}
            </Link>
          </Button>
        </div>

        {lessonsList.length === 0 ? (
          <Card className="border-2 border-[#C5CBE3] bg-white">
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-semibold">{LABELS.HISTORY_LESSONS_EMPTY_TITLE}</h3>
              <p className="mb-4 text-muted-foreground">{LABELS.HISTORY_LESSONS_EMPTY_DESC}</p>
              <Button asChild>
                <Link href="/">{LABELS.CHAT_WITH_AI}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {lessonsList.map((lesson) => (
              <HistoryLessonCard
                key={lesson.id}
                lessonId={lesson.id}
                title={lesson.title}
                sourceType={lesson.source_type}
                createdAtLabel={formatDate(lesson.created_at)}
              />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  )
}
