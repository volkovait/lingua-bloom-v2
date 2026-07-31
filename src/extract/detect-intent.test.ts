import { describe, expect, it } from 'vitest'

import { extractCandidates } from './candidates'
import { detectMaterialIntent, resolveMaterialIntent } from './detect-intent'

describe('detectMaterialIntent', () => {
  it('возвращает reproduce_test при извлечённых кандидатах', () => {
    const text = ['1. What is 2+2?', 'A) 3', 'B) 4'].join('\n')
    expect(detectMaterialIntent(text, 'Quiz')).toBe('reproduce_test')
  })

  it('возвращает reproduce_test по фразе «раскройте скобки»', () => {
    expect(detectMaterialIntent('Раскройте скобки: 1. He (to go) home.', 'Grammar')).toBe(
      'reproduce_test',
    )
  })

  it('возвращает generate_from_content для обычного текста', () => {
    expect(detectMaterialIntent('London is the capital of England. It is a big city.', 'Reading')).toBe(
      'generate_from_content',
    )
  })

  it('resolveMaterialIntent отдаёт приоритет reproduce', () => {
    expect(
      resolveMaterialIntent('generate_from_content', '1. A ___ B.', 'Test'),
    ).toBe('reproduce_test')
  })
})

describe('extractCandidates bracketGap', () => {
  it('извлекает ≥10 bracketGap из сниппета raw.txt', () => {
    const snippet = [
      'Упражнение 197',
      'Раскройте скобки, употребляя глаголы в Present Simple или Past Simple.',
      '1. His sister (to study) English every day. 2. She (to study) English two hours ago.',
      '3. You (to come) home at six o\'clock yesterday? 4. I (to go) to bed at ten o\'clock every day.',
      '5. I (to go) to bed at ten o\'clock yesterday. 6. My brother (to wash) his face every morning.',
      '7. Last night he (to wash) his face with soap and water. 8. I (not to have) history lessons every day.',
      '9. We (not to rest) yesterday. 10. My brother (not to drink) coffee yesterday.',
      '11. My mother always (to take) a bus to get to work. 12. You (to talk) to the members every day?',
      '13. Your sister (to go) to school every day? 14. Mary (to like) writing stories.',
    ].join('\n')

    const { candidates, hasReadyExercises } = extractCandidates(snippet)
    expect(hasReadyExercises).toBe(true)
    expect(candidates.length).toBeGreaterThanOrEqual(10)
    expect(candidates.every((candidate) => candidate.kind === 'bracketGap')).toBe(true)
  })

  it('hasReadyExercises true при одном MCQ', () => {
    const text = ['1. Capital?', 'A) Paris', 'B) Rome'].join('\n')
    const { candidates, hasReadyExercises } = extractCandidates(text)
    expect(candidates).toHaveLength(1)
    expect(hasReadyExercises).toBe(true)
  })
})
