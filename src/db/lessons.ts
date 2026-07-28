import type { SupabaseClient } from '@supabase/supabase-js'

import type { LessonSpec } from '@/src/lesson-spec/schema'

export type LessonSourceType = 'pdf' | 'text'

export type LessonRow = {
  id: string
  user_id: string
  title: string
  source_type: LessonSourceType
  html_body: string
  spec_json: LessonSpec
  meta: Record<string, unknown>
  generation_run_id: string | null
  created_at: string
}

const LESSONS = 'lessons'

export async function saveLesson(
  client: SupabaseClient,
  input: {
    userId: string
    title: string
    sourceType: LessonSourceType
    htmlBody: string
    spec: LessonSpec
    meta?: Record<string, unknown>
    generationRunId?: string
  },
): Promise<string> {
  const { data, error } = await client
    .from(LESSONS)
    .insert({
      user_id: input.userId,
      title: input.title,
      // Схема lessons допускает source_type ∈ (pdf|image|chat); v2 использует pdf|text → text маппим в chat.
      source_type: input.sourceType === 'pdf' ? 'pdf' : 'chat',
      html_body: input.htmlBody,
      spec_json: input.spec,
      meta: input.meta ?? {},
      generation_run_id: input.generationRunId ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Не удалось сохранить урок: ${error.message}`)
  return data.id as string
}

export async function getLesson(client: SupabaseClient, lessonId: string): Promise<LessonRow | null> {
  const { data, error } = await client.from(LESSONS).select('*').eq('id', lessonId).maybeSingle()
  if (error) throw new Error(`Не удалось прочитать урок: ${error.message}`)
  return (data as LessonRow | null) ?? null
}

export async function listLessons(
  client: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<Pick<LessonRow, 'id' | 'title' | 'source_type' | 'created_at'>[]> {
  const { data, error } = await client
    .from(LESSONS)
    .select('id, title, source_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Не удалось получить список уроков: ${error.message}`)
  return (data as Pick<LessonRow, 'id' | 'title' | 'source_type' | 'created_at'>[] | null) ?? []
}

export async function deleteLesson(client: SupabaseClient, lessonId: string): Promise<void> {
  const { error } = await client.from(LESSONS).delete().eq('id', lessonId)
  if (error) throw new Error(`Не удалось удалить урок: ${error.message}`)
}
