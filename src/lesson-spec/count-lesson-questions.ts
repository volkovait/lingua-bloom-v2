import type { LessonSpec } from '@/src/lesson-spec/schema'

export function countQuestionsInLessonSpec(spec: LessonSpec): number {
  let total = 0
  for (const part of spec.parts) {
    for (const exercise of part.exercises) {
      total += exercise.questions.length
    }
  }
  return total
}
