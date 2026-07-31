import type { PartExercises } from '@/src/agents/exercise-contract'
import type { ExtractedCandidate } from '@/src/extract/types'
import type { LessonExercise } from '@/src/lesson-spec/schema'

type InputKindGroup = 'radio' | 'gapFill'

/** Placeholder для gapFill без явного ответа в источнике (заполнится auto_solve). */
const PENDING_GAP_TOKEN = '…'

function normalizeGapMarkers(text: string): string {
  return text.replace(/_{3,}/g, '___')
}

function groupInputKind(candidate: ExtractedCandidate): InputKindGroup {
  if (candidate.kind === 'mcq' || candidate.kind === 'trueFalse') return 'radio'
  return 'gapFill'
}

function bracketToGapTemplate(prompt: string): string {
  return normalizeGapMarkers(prompt).replace(/\((?:not\s+)?(?:to\s+)?[^)]+\)/gi, '___')
}

function extractBracketAnswer(bracketContent: string): string {
  const trimmed = bracketContent.trim()
  const notToMatch = /^not\s+to\s+(.+)$/i.exec(trimmed)
  if (notToMatch) return `not ${notToMatch[1].trim()}`
  const toMatch = /^to\s+(.+)$/i.exec(trimmed)
  if (toMatch) return toMatch[1].trim()
  return trimmed
}

function extractAllBracketAnswers(prompt: string): string[] {
  const answers: string[] = []
  const pattern = /\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(prompt)) !== null) {
    const inner = match[1]?.trim() ?? ''
    if (/^(?:not\s+)?(?:to\s+)?[a-zA-Z]/i.test(inner)) {
      answers.push(extractBracketAnswer(inner))
    }
  }
  return answers
}

function countGapMarkers(template: string): number {
  if (!template.includes('___')) return 0
  return template.split('___').length - 1
}

function buildRadioQuestion(candidate: ExtractedCandidate, index: number) {
  if (candidate.kind === 'trueFalse') {
    const correctKey =
      candidate.answer === 'true' ? 'A' : candidate.answer === 'false' ? 'B' : 'A'
    return {
      id: `q${index + 1}`,
      prompt: candidate.prompt,
      options: [
        { key: 'A', text: 'Верно' },
        { key: 'B', text: 'Неверно' },
      ],
      correctKey,
    }
  }

  const options = candidate.options.map((option) => ({
    key: option.label,
    text: option.text,
  }))
  const correctKey =
    candidate.answer && options.some((option) => option.key === candidate.answer)
      ? candidate.answer
      : options[0]?.key ?? 'A'

  return {
    id: `q${index + 1}`,
    prompt: candidate.prompt,
    options,
    correctKey,
  }
}

function buildGapQuestion(candidate: ExtractedCandidate, index: number) {
  const gapTemplate =
    candidate.kind === 'bracketGap' ? bracketToGapTemplate(candidate.prompt) : candidate.prompt

  const base = {
    id: `q${index + 1}`,
    prompt: candidate.prompt,
    gapTemplate,
  }

  const gapCount = countGapMarkers(gapTemplate)
  if (gapCount > 1) {
    const bracketTokens =
      candidate.kind === 'bracketGap' ? extractAllBracketAnswers(candidate.prompt) : []
    const tokens =
      bracketTokens.length === gapCount
        ? bracketTokens
        : Array.from({ length: gapCount }, () => PENDING_GAP_TOKEN)
    return { ...base, gapCorrectTokens: tokens }
  }

  const token = candidate.answer?.trim() || PENDING_GAP_TOKEN
  return { ...base, gapCorrectToken: token }
}

function buildExerciseForGroup(
  groupKind: InputKindGroup,
  groupCandidates: ExtractedCandidate[],
  partTitle: string,
  startIndex: number,
): LessonExercise {
  const questions =
    groupKind === 'radio'
      ? groupCandidates.map((candidate, offset) => buildRadioQuestion(candidate, startIndex + offset))
      : groupCandidates.map((candidate, offset) => buildGapQuestion(candidate, startIndex + offset))

  return {
    title: partTitle.trim() || 'Задания',
    inputKind: groupKind,
    questions,
  }
}

/** Детерминированно преобразует извлечённые кандидаты в упражнения (без LLM). */
export function mapCandidatesToPartExercises(input: {
  candidates: ExtractedCandidate[]
  partTitle: string
}): PartExercises {
  const { candidates, partTitle } = input
  if (candidates.length === 0) {
    throw new Error('Нет кандидатов для воспроизведения теста.')
  }

  const groups = new Map<InputKindGroup, ExtractedCandidate[]>()
  for (const candidate of candidates) {
    const kind = groupInputKind(candidate)
    const bucket = groups.get(kind) ?? []
    bucket.push(candidate)
    groups.set(kind, bucket)
  }

  const exercises: LessonExercise[] = []
  let questionOffset = 0
  for (const groupKind of ['radio', 'gapFill'] as const) {
    const groupCandidates = groups.get(groupKind)
    if (!groupCandidates || groupCandidates.length === 0) continue
    exercises.push(buildExerciseForGroup(groupKind, groupCandidates, partTitle, questionOffset))
    questionOffset += groupCandidates.length
  }

  return { exercises }
}

export { bracketToGapTemplate, PENDING_GAP_TOKEN }
