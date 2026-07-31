import { describe, expect, it } from 'vitest'

import type { ExtractedCandidate } from '@/src/extract/types'
import { finalizeLessonSpec } from '@/src/lesson-spec/finalize'
import { checkSpecFidelity } from '@/src/lesson-spec/fidelity-check'
import { mapCandidatesToPartExercises } from '@/src/lesson-spec/map-candidates-to-spec'

describe('mapCandidatesToPartExercises', () => {
  it('группирует bracketGap в одно gapFill-упражнение', () => {
    const candidates: ExtractedCandidate[] = [
      {
        kind: 'bracketGap',
        prompt: 'His sister (to study) English every day.',
        options: [],
        answer: 'study',
        sourceIndex: 0,
      },
      {
        kind: 'bracketGap',
        prompt: 'She (to study) English two hours ago.',
        options: [],
        answer: 'study',
        sourceIndex: 1,
      },
    ]

    const mapped = mapCandidatesToPartExercises({ candidates, partTitle: 'Grammar' })
    expect(mapped.exercises).toHaveLength(1)
    expect(mapped.exercises[0]?.inputKind).toBe('gapFill')
    expect(mapped.exercises[0]?.questions).toHaveLength(2)
    expect(mapped.exercises[0]?.questions[0]?.gapTemplate).toContain('___')
  })

  it('разделяет radio и gapFill по разным упражнениям', () => {
    const candidates: ExtractedCandidate[] = [
      {
        kind: 'mcq',
        prompt: 'Capital of France?',
        options: [
          { label: 'A', text: 'Paris' },
          { label: 'B', text: 'Berlin' },
        ],
        answer: 'A',
        sourceIndex: 0,
      },
      {
        kind: 'gap',
        prompt: 'She ___ to school.',
        options: [],
        answer: 'goes',
        sourceIndex: 1,
      },
    ]

    const mapped = mapCandidatesToPartExercises({ candidates, partTitle: 'Mixed' })
    expect(mapped.exercises).toHaveLength(2)
    const kinds = mapped.exercises.map((exercise) => exercise.inputKind)
    expect(kinds).toContain('radio')
    expect(kinds).toContain('gapFill')
  })
})

describe('checkSpecFidelity', () => {
  it('пропускает spec с тем же числом вопросов', () => {
    const candidates: ExtractedCandidate[] = [
      {
        kind: 'bracketGap',
        prompt: 'His sister (to study) English every day.',
        options: [],
        answer: 'study',
        sourceIndex: 0,
      },
    ]
    const mapped = mapCandidatesToPartExercises({ candidates, partTitle: 'T' })
    const { spec } = finalizeLessonSpec({ title: 'T', parts: [{ title: 'T', exercises: mapped.exercises }] })
    const result = checkSpecFidelity(spec, candidates)
    expect(result.ok).toBe(true)
  })

  it('отклоняет spec с лишними вопросами', () => {
    const candidates: ExtractedCandidate[] = [
      {
        kind: 'mcq',
        prompt: 'Question one?',
        options: [
          { label: 'A', text: 'Yes' },
          { label: 'B', text: 'No' },
        ],
        answer: 'A',
        sourceIndex: 0,
      },
    ]
    const mapped = mapCandidatesToPartExercises({ candidates, partTitle: 'T' })
    const extraQuestion = {
      ...mapped.exercises[0]!.questions[0]!,
      id: 'q2',
      prompt: 'Invented question?',
    }
    const { spec } = finalizeLessonSpec({
      title: 'T',
      parts: [
        {
          title: 'T',
          exercises: [
            {
              ...mapped.exercises[0]!,
              questions: [...mapped.exercises[0]!.questions, extraQuestion],
            },
          ],
        },
      ],
    })
    const result = checkSpecFidelity(spec, candidates)
    expect(result.ok).toBe(false)
    expect(result.warnings.some((warning) => warning.includes('лишние'))).toBe(true)
  })
})
