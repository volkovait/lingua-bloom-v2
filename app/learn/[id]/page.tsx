import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { LABELS } from '@/lib/consts'
import { isAuthDisabled } from '@/src/auth/auth-disabled'
import { getCurrentUserId } from '@/src/auth/session'
import { getLesson } from '@/src/db/lessons'
import { createServiceRoleClient } from '@/src/db/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  if (!userId) notFound()

  const lesson = await getLesson(createServiceRoleClient(), id)
  if (!lesson) notFound()
  if (!isAuthDisabled() && lesson.user_id !== userId) notFound()

  return (
    <AppShell>
      <main className="flex min-h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center justify-between gap-3 border-b-2 border-[#C5CBE3] px-4 py-3 sm:px-6">
          <h1 className="truncate font-serif text-lg font-semibold text-primary">{lesson.title}</h1>
          <Link href="/history" className="shrink-0 text-sm text-primary hover:underline">
            ← {LABELS.NAV_HISTORY_TESTS}
          </Link>
        </div>
        <iframe
          title={lesson.title}
          srcDoc={lesson.html_body}
          sandbox="allow-scripts allow-same-origin"
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </main>
    </AppShell>
  )
}
