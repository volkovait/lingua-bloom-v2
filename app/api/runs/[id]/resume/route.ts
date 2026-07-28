import { after, NextResponse } from 'next/server'

import { isAuthDisabled } from '@/src/auth/auth-disabled'
import { getCurrentUserId } from '@/src/auth/session'
import { createServiceRoleClient } from '@/src/db/supabase'
import { fetchRun, updateRun } from '@/src/db/runs'
import { Command, runGenerationInBackground } from '@/src/supervisor/run-executor'

export const runtime = 'nodejs'
export const maxDuration = 300

/** POST /api/runs/:id/resume — продолжить прерванный прогон (HITL). Body: { resume: unknown }. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const client = createServiceRoleClient()
  const run = await fetchRun(client, id)
  if (!run) return NextResponse.json({ error: 'Прогон не найден' }, { status: 404 })
  if (!isAuthDisabled() && run.user_id !== userId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  if (run.status !== 'interrupted') {
    return NextResponse.json({ error: 'Прогон не ожидает продолжения' }, { status: 409 })
  }

  const body = (await request.json().catch(() => ({}))) as { resume?: unknown }
  await updateRun(client, { runId: id, status: 'running', phase: 'resumed', payloadPatch: { interrupt: null } })

  after(() =>
    runGenerationInBackground({
      userId: run.user_id,
      runId: id,
      threadId: run.thread_id,
      command: new Command({ resume: body.resume }),
    }),
  )

  return NextResponse.json({ accepted: true, runId: id, threadId: run.thread_id }, { status: 202 })
}
