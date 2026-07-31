import type { ExtractedCandidate } from '@/src/extract/types'
import { bracketToGapTemplate } from '@/src/lesson-spec/map-candidates-to-spec'
import { countQuestionsInLessonSpec } from '@/src/lesson-spec/count-lesson-questions'
import type { LessonSpec } from '@/src/lesson-spec/schema'

export type FidelityCheckResult = {
  ok: boolean
  warnings: string[]
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/_{3,}/g, '___')
    .replace(/\((?:not\s+)?(?:to\s+)?[^)]+\)/gi, '___')
    .replace(/[^\p{L}\p{N}\s_…]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function promptTokens(text: string): string[] {
  return normalizeForMatch(text)
    .split(' ')
    .filter((token) => token.length >= 4)
}

function collectSpecTexts(spec: LessonSpec): string {
  return spec.parts
    .flatMap((part) =>
      part.exercises.flatMap((exercise) =>
        exercise.questions.flatMap((question) => [
          question.prompt,
          question.gapTemplate ?? '',
        ]),
      ),
    )
    .join('\n')
}

function candidateMatchesSpec(candidate: ExtractedCandidate, specText: string): boolean {
  const normalizedSpec = normalizeForMatch(specText)
  const normalizedPrompt = normalizeForMatch(candidate.prompt)
  const normalizedTemplate = normalizeForMatch(bracketToGapTemplate(candidate.prompt))

  if (normalizedPrompt.length >= 8 && normalizedSpec.includes(normalizedPrompt.slice(0, 40))) {
    return true
  }

  if (normalizedTemplate.length >= 8 && normalizedSpec.includes(normalizedTemplate.slice(0, 40))) {
    return true
  }

  const tokens = promptTokens(candidate.prompt)
  if (tokens.length === 0) return false
  const matched = tokens.filter((token) => normalizedSpec.includes(token))
  return matched.length >= Math.min(3, tokens.length)
}

/** Проверяет, что spec не содержит лишних вопросов относительно извлечённых кандидатов. */
export function checkSpecFidelity(spec: LessonSpec, candidates: ExtractedCandidate[]): FidelityCheckResult {
  const warnings: string[] = []
  const questionCount = countQuestionsInLessonSpec(spec)
  const candidateCount = candidates.length

  if (questionCount > candidateCount) {
    warnings.push(
      `В спецификации ${questionCount} вопросов, а извлечено ${candidateCount} — лишние вопросы недопустимы.`,
    )
  }

  if (questionCount < candidateCount) {
    warnings.push(
      `В спецификации ${questionCount} вопросов, а извлечено ${candidateCount} — часть заданий потеряна.`,
    )
  }

  const specText = collectSpecTexts(spec)

  for (const candidate of candidates) {
    if (!candidateMatchesSpec(candidate, specText)) {
      warnings.push(`Формулировка кандидата не найдена в spec: «${candidate.prompt.slice(0, 80)}…»`)
    }
  }

  const inputKinds = new Set(
    spec.parts.flatMap((part) => part.exercises.map((exercise) => exercise.inputKind ?? 'radio')),
  )
  if (inputKinds.size > 2) {
    warnings.push(`Слишком много типов заданий (${inputKinds.size}): ${[...inputKinds].join(', ')}`)
  }

  return { ok: warnings.length === 0, warnings }
}
