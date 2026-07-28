import { NextResponse } from 'next/server'

import { isAuthDisabled } from '@/src/auth/auth-disabled'
import { getCurrentUserId } from '@/src/auth/session'
import { createServiceRoleClient } from '@/src/db/supabase'
import { fetchRun, listEvents } from '@/src/db/runs'

export const runtime = 'nodejs'

/** GET /api/runs/:id/events?afterSeq=N — статус прогона + новые события (poll). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const afterSeq = Number(new URL(request.url).searchParams.get('afterSeq') ?? '0') || 0
  const client = createServiceRoleClient()

  const run = await fetchRun(client, id)
  if (!run) return NextResponse.json({ error: 'Прогон не найден' }, { status: 404 })
  if (!isAuthDisabled() && run.user_id !== userId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  const events = await listEvents(client, { runId: id, afterSeq })
  const interrupt = (run.payload as { interrupt?: unknown })?.interrupt ?? null

  return NextResponse.json({
    run: {
      status: run.status,
      phase: run.phase,
      title: run.title,
      lessonId: run.lesson_id,
      errorCode: run.error_code,
      errorMessage: run.error_message,
      interrupt: run.status === 'interrupted' ? interrupt : null,
    },
    events,
  })
}
