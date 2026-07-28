import { attachRuntime } from '@/src/lesson-spec/attach-runtime'
import { normalizeLessonSpecFromModel } from '@/src/lesson-spec/normalize-lesson-spec'
import { pruneLooseLessonSpecToValidModel } from '@/src/lesson-spec/prune-invalid-lesson-questions'
import { LESSON_SPEC_VERSION, type LessonExercise, type LessonSpec } from '@/src/lesson-spec/schema'

/**
 * Приводит собранные части к валидной LessonSpec:
 * coerce (mcq/gap) → prune невалидных вопросов → normalize ключей → attach runtime.
 */
export function finalizeLessonSpec(input: {
  title: string
  parts: Array<{ title: string; exercises: LessonExercise[] }>
}): { spec: LessonSpec; warnings: string[] } {
  const loose = {
    version: LESSON_SPEC_VERSION,
    title: input.title.trim() || 'Тест',
    parts: input.parts.map((part, index) => ({
      title: part.title.trim() || `Часть ${index + 1}`,
      exercises: part.exercises,
    })),
  }

  const pruned = pruneLooseLessonSpecToValidModel(loose)
  if (!pruned) {
    throw new Error('Не удалось собрать валидную спецификацию теста: все вопросы отбракованы валидацией.')
  }
  const normalized = normalizeLessonSpecFromModel(pruned.model)
  const spec = attachRuntime(normalized)
  return { spec, warnings: pruned.warnings }
}
