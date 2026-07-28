import { describe, expect, it } from 'vitest'

import { extractCandidates } from './candidates'

describe('extractCandidates', () => {
  it('извлекает MCQ с буквенными вариантами и ключами из секции ответов', () => {
    const text = [
      '1. What is the capital of France?',
      'A) Berlin',
      'B) Paris',
      'C) Madrid',
      '',
      '2. Which is a fruit?',
      'A) Carrot',
      'B) Apple',
      '',
      'Answers:',
      '1. B',
      '2. B',
    ].join('\n')

    const { candidates, hasReadyExercises } = extractCandidates(text)
    expect(hasReadyExercises).toBe(true)
    expect(candidates).toHaveLength(2)
    expect(candidates[0].kind).toBe('mcq')
    expect(candidates[0].prompt).toContain('capital of France')
    expect(candidates[0].options).toHaveLength(3)
    expect(candidates[0].answer).toBe('B')
    expect(candidates[1].answer).toBe('B')
  })

  it('распознаёт true/false по вариантам и ключам верно/неверно', () => {
    const text = [
      '1. Земля плоская.',
      'A) верно',
      'B) неверно',
      '',
      'Ключи:',
      '1. неверно',
    ].join('\n')

    const { candidates } = extractCandidates(text)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].kind).toBe('trueFalse')
    expect(candidates[0].answer).toBe('false')
  })

  it('извлекает пропуски (gap) в нумерованных вопросах', () => {
    const text = ['1. She ___ to school every day.', '2. They ___ football on Sundays.'].join('\n')
    const { candidates } = extractCandidates(text)
    expect(candidates).toHaveLength(2)
    expect(candidates.every((c) => c.kind === 'gap')).toBe(true)
    expect(candidates[0].answer).toBeNull()
  })

  it('fallback: одиночные предложения с пропусками без нумерации', () => {
    const text = ['I ___ a student.', 'You ___ welcome.'].join('\n')
    const { candidates } = extractCandidates(text)
    expect(candidates).toHaveLength(2)
    expect(candidates[0].kind).toBe('gap')
  })

  it('нет готовых заданий в обычном тексте', () => {
    const text = 'Это просто абзац учебного текста без заданий и вопросов.'
    const { candidates, hasReadyExercises } = extractCandidates(text)
    expect(candidates).toHaveLength(0)
    expect(hasReadyExercises).toBe(false)
  })
})
