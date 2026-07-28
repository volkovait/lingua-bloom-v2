import { describe, expect, it } from 'vitest'

import { lessonSpecSchema } from './schema'
import { finalizeLessonSpec } from './finalize'

describe('finalizeLessonSpec', () => {
  it('собирает валидную LessonSpec из корректных упражнений и нормализует ключи', () => {
    const { spec, warnings } = finalizeLessonSpec({
      title: 'Present Simple',
      parts: [
        {
          title: 'Часть 1',
          exercises: [
            {
              title: 'Выбор варианта',
              inputKind: 'radio',
              questions: [
                {
                  id: 'q1',
                  prompt: 'She ___ to school.',
                  options: [
                    { key: '1', text: 'go' },
                    { key: '2', text: 'goes' },
                  ],
                  correctKey: 'goes',
                },
              ],
            },
          ],
        },
      ],
    })

    expect(warnings).toHaveLength(0)
    const parsed = lessonSpecSchema.safeParse(spec)
    expect(parsed.success).toBe(true)
    // Ключи нормализованы к буквам, correctKey указывает на верный вариант.
    const q = spec.parts[0].exercises[0].questions[0]
    expect(q.options?.map((o) => o.key)).toEqual(['A', 'B'])
    expect(q.correctKey).toBe('B')
    expect(spec.runtime.localStorageKey.length).toBeGreaterThan(7)
  })

  it('отбраковывает невалидные вопросы, но сохраняет валидные', () => {
    const { spec } = finalizeLessonSpec({
      title: 'Mixed',
      parts: [
        {
          title: 'Часть 1',
          exercises: [
            {
              title: 'Набор',
              inputKind: 'radio',
              questions: [
                {
                  id: 'ok',
                  prompt: 'Valid?',
                  options: [
                    { key: 'A', text: 'yes' },
                    { key: 'B', text: 'no' },
                  ],
                  correctKey: 'A',
                },
                // Невалидный: нет options/correctKey — должен быть отброшен.
                { id: 'bad', prompt: 'Broken question' },
              ],
            },
          ],
        },
      ],
    })

    const allIds = spec.parts.flatMap((p) => p.exercises.flatMap((e) => e.questions.map((q) => q.id)))
    expect(allIds).toContain('ok')
    expect(allIds).not.toContain('bad')
  })
})
