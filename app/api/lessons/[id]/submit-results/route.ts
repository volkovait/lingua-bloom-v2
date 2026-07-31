import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getLesson } from '@/src/db/lessons'
import { createServiceRoleClient } from '@/src/db/supabase'
import { resolveTelegramDelivery } from '@/src/telegram/delivery'
import { notifyTestResults } from '@/src/telegram/notifications'

export const runtime = 'nodejs'

const submitResultsSchema = z.object({
  studentName: z.string().trim().min(1).max(200),
  score: z.number().int().min(0),
  max: z.number().int().min(1),
  rows: z
    .array(
      z.object({
        serial: z.number().int().min(1),
        ok: z.boolean(),
        studentLine: z.string().max(2000),
        correctLine: z.string().max(2000),
      }),
    )
    .max(200),
})

/** POST /api/lessons/:id/submit-results — отправка результатов теста в Telegram владельца урока. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const client = createServiceRoleClient()
  const lesson = await getLesson(client, id)
  if (!lesson) return NextResponse.json({ error: 'Урок не найден' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = submitResultsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные результатов' }, { status: 400 })
  }

  const delivery = await resolveTelegramDelivery(lesson.user_id)
  if (!delivery) {
    return NextResponse.json({ sent: false, reason: 'telegram_not_configured' })
  }

  try {
    await notifyTestResults(delivery, {
      lessonTitle: lesson.title,
      studentName: parsed.data.studentName,
      score: parsed.data.score,
      max: parsed.data.max,
      rows: parsed.data.rows,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось отправить в Telegram'
    console.error('Telegram notifyTestResults failed:', error)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
