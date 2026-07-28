import { randomUUID } from 'node:crypto'

import { after, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/src/auth/session'
import { createServiceRoleClient } from '@/src/db/supabase'
import { insertRun } from '@/src/db/runs'
import { extractPdfText } from '@/src/extract/pdf'
import { runGenerationInBackground } from '@/src/supervisor/run-executor'

export const runtime = 'nodejs'
export const maxDuration = 300

/** POST /api/runs — старт прогона из текста и/или PDF-файлов (multipart/form-data). */
export async function POST(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ожидается multipart/form-data' }, { status: 400 })
  }

  const title = String(form.get('title') ?? '').trim() || 'Тест'
  const text = String(form.get('text') ?? '').trim()
  const correctAnswersHint = String(form.get('correctAnswersHint') ?? '').trim()
  const autoSolveRequested = String(form.get('autoSolve') ?? '') === 'true'

  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  const chunks: string[] = []
  let hasPdf = false
  for (const file of files) {
    if (file.type === 'application/pdf') {
      hasPdf = true
      try {
        const extracted = await extractPdfText(await file.arrayBuffer())
        if (extracted.trim()) chunks.push(extracted)
      } catch {
        return NextResponse.json(
          { error: `Не удалось извлечь текст из PDF «${file.name}».` },
          { status: 400 },
        )
      }
    } else {
      return NextResponse.json(
        { error: `Тип файла «${file.type || 'неизвестно'}» не поддерживается (только PDF).` },
        { status: 400 },
      )
    }
  }

  const material = [text, ...chunks].filter((c) => c.trim().length > 0).join('\n\n').trim()
  if (!material) {
    return NextResponse.json({ error: 'Пустой материал: добавьте текст или PDF.' }, { status: 400 })
  }

  const runId = randomUUID()
  const threadId = runId
  const client = createServiceRoleClient()
  await insertRun(client, { runId, userId, threadId, title })

  after(() =>
    runGenerationInBackground({
      userId,
      runId,
      threadId,
      initialState: {
        title,
        material,
        sourceType: hasPdf ? 'pdf' : 'text',
        correctAnswersHint,
        autoSolveRequested,
      },
    }),
  )

  return NextResponse.json({ accepted: true, runId, threadId }, { status: 202 })
}
