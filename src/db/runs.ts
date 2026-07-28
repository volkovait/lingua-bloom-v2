import type { SupabaseClient } from '@supabase/supabase-js'

export type RunStatus = 'running' | 'interrupted' | 'failed' | 'completed'
export type RunMode = 'ready_material' | 'raw_material'

export type LessonGenerationRunRow = {
  id: string
  user_id: string
  thread_id: string
  status: RunStatus
  phase: string
  mode: RunMode | null
  lesson_id: string | null
  error_code: string | null
  error_message: string | null
  title: string | null
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type RunEventRow = {
  seq: number
  emoji: string
  title: string
  detail: string | null
  node_id: string | null
  created_at: string
}

const RUNS = 'lesson_generation_runs'
const EVENTS = 'lesson_generation_events'

export async function insertRun(
  client: SupabaseClient,
  input: { runId: string; userId: string; threadId: string; title?: string; mode?: RunMode },
): Promise<void> {
  const { error } = await client.from(RUNS).insert({
    id: input.runId,
    user_id: input.userId,
    thread_id: input.threadId,
    status: 'running',
    phase: 'init',
    // mode NOT NULL в схеме — ставим дефолт до классификации (classify обновит).
    mode: input.mode ?? 'ready_material',
    ...(input.title ? { title: input.title } : {}),
  })
  if (error) throw new Error(`Не удалось создать прогон: ${error.message}`)
}

export async function updateRun(
  client: SupabaseClient,
  input: {
    runId: string
    status?: RunStatus
    phase?: string
    mode?: RunMode
    lessonId?: string | null
    errorCode?: string | null
    errorMessage?: string | null
    payloadPatch?: Record<string, unknown>
  },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.status !== undefined) patch.status = input.status
  if (input.phase !== undefined) patch.phase = input.phase
  if (input.mode !== undefined) patch.mode = input.mode
  if (input.lessonId !== undefined) patch.lesson_id = input.lessonId
  if (input.errorCode !== undefined) patch.error_code = input.errorCode
  if (input.errorMessage !== undefined) patch.error_message = input.errorMessage

  if (input.payloadPatch && Object.keys(input.payloadPatch).length > 0) {
    const { data } = await client.from(RUNS).select('payload').eq('id', input.runId).maybeSingle()
    const current = (data?.payload as Record<string, unknown> | undefined) ?? {}
    patch.payload = { ...current, ...input.payloadPatch }
  }

  const { error } = await client.from(RUNS).update(patch).eq('id', input.runId)
  if (error) throw new Error(`Не удалось обновить прогон: ${error.message}`)
}

export async function fetchRun(
  client: SupabaseClient,
  runId: string,
): Promise<LessonGenerationRunRow | null> {
  const { data, error } = await client.from(RUNS).select('*').eq('id', runId).maybeSingle()
  if (error) throw new Error(`Не удалось прочитать прогон: ${error.message}`)
  return (data as LessonGenerationRunRow | null) ?? null
}

/** Добавляет событие лога, вычисляя следующий seq. Один ретрай при гонке по unique(run_id, seq). */
export async function appendEvent(
  client: SupabaseClient,
  input: { runId: string; emoji: string; title: string; detail?: string; nodeId?: string },
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data } = await client
      .from(EVENTS)
      .select('seq')
      .eq('run_id', input.runId)
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSeq = ((data?.seq as number | undefined) ?? 0) + 1
    const { error } = await client.from(EVENTS).insert({
      run_id: input.runId,
      seq: nextSeq,
      emoji: input.emoji,
      title: input.title,
      detail: input.detail ?? null,
      node_id: input.nodeId ?? null,
    })
    if (!error) return
    if (attempt === 1) throw new Error(`Не удалось записать событие прогона: ${error.message}`)
  }
}

export async function listEvents(
  client: SupabaseClient,
  input: { runId: string; afterSeq?: number },
): Promise<RunEventRow[]> {
  const { data, error } = await client
    .from(EVENTS)
    .select('seq, emoji, title, detail, node_id, created_at')
    .eq('run_id', input.runId)
    .gt('seq', input.afterSeq ?? 0)
    .order('seq', { ascending: true })
  if (error) throw new Error(`Не удалось прочитать события прогона: ${error.message}`)
  return (data as RunEventRow[] | null) ?? []
}
