/**
 * До Zod: нормализует маркеры пропусков в gapTemplate.
 * Модели из PDF часто пишут «1__________» или «__________» вместо ровно «___»,
 * из‑за чего счётчик пропусков завышается и валидация отбраковывает вопросы.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Сводит нумерованные и длинные подчёркивания к единому маркеру «___». */
export function normalizeGapTemplateMarkers(template: string): string {
  let out = template
  // «1__________», «2_____» перед пропуском
  out = out.replace(/\d+_+/g, '___')
  // любая последовательность из 3+ подчёркиваний
  out = out.replace(/_{3,}/g, '___')
  return out
}

function coerceGapQuestion(question: Record<string, unknown>): void {
  const template = question.gapTemplate
  if (typeof template !== 'string' || !template.includes('_')) return
  const normalized = normalizeGapTemplateMarkers(template)
  if (normalized !== template) {
    question.gapTemplate = normalized
  }
  const prompt = question.prompt
  if (typeof prompt === 'string' && prompt.includes('_')) {
    const normalizedPrompt = normalizeGapTemplateMarkers(prompt)
    if (normalizedPrompt !== prompt) {
      question.prompt = normalizedPrompt
    }
  }
}

/** Мутирует объект после JSON.parse: нормализует gapTemplate/prompt для gapFill/gapDrag. */
export function coerceGapInLessonSpecJson(value: unknown): void {
  if (!isRecord(value)) return
  const parts = value.parts
  if (!Array.isArray(parts)) return
  for (const part of parts) {
    if (!isRecord(part)) continue
    const exercises = part.exercises
    if (!Array.isArray(exercises)) continue
    for (const exercise of exercises) {
      if (!isRecord(exercise)) continue
      const inputKind = exercise.inputKind
      if (inputKind !== 'gapFill' && inputKind !== 'gapDrag') continue
      const questions = exercise.questions
      if (!Array.isArray(questions)) continue
      for (const question of questions) {
        if (!isRecord(question)) continue
        coerceGapQuestion(question)
      }
    }
  }
}
