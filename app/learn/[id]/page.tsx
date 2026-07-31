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

function injectLessonMeta(
  htmlBody: string,
  meta: { lessonId: string; title: string },
): string {
  const script = `<script>window.__LESSON_META__=${JSON.stringify(meta).replace(/</g, '\\u003c')}</script>`
  const runtimeTag = '<script src="/lesson-runtime.js"></script>'
  if (htmlBody.includes(runtimeTag)) {
    return htmlBody.replace(runtimeTag, `${script}\n  ${runtimeTag}`)
  }
  return `${htmlBody}\n${script}\n${runtimeTag}`
}

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  if (!userId) notFound()

  const lesson = await getLesson(createServiceRoleClient(), id)
  if (!lesson) notFound()
  if (!isAuthDisabled() && lesson.user_id !== userId) notFound()

  const htmlBody = injectLessonMeta(lesson.html_body, { lessonId: id, title: lesson.title })

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
          srcDoc={htmlBody}
          sandbox="allow-scripts allow-same-origin"
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </main>
    </AppShell>
  )
}
