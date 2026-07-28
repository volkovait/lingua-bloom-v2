import { randomUUID } from 'node:crypto'

import { lessonSpecSchema, type LessonSpec, type LessonSpecFromModel } from '@/src/lesson-spec/schema'

/** Достраивает runtime-поля, которые сервер добавляет после валидации модели. */
export function attachRuntime(spec: LessonSpecFromModel): LessonSpec {
  const withRuntime = {
    ...spec,
    runtime: { localStorageKey: `lesson-${randomUUID()}` },
  }
  return lessonSpecSchema.parse(withRuntime)
}
