import type { LessonSpecFromModel } from '@/src/lesson-spec/schema'
import { stripHtmlTags } from '@/src/lesson-spec/sanitize-lesson-text'

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

function safeStrip(s: string): string {
  const t = stripHtmlTags(s)
  return t.length > 0 ? t : '—'
}

/** Убирает ведущий «A) » / «b)» из текста варианта, если модель продублировала букву. */
function stripLeadingOptionLabel(text: string): string {
  const t = text.replace(/^[A-Za-z]\)\s*/, '').trim()
  return t.length > 0 ? t : text
}

/**
 * Переназначает ключи вариантов на A, B, C, … и обновляет correctKey (после stripHtml на text).
 */
function normalizeMcqQuestion(q: {
  prompt: string
  options?: Array<{ key: string; text: string }>
  correctKey?: string
  wordBank?: string[]
  correctSentence?: string
}): void {
  q.prompt = safeStrip(q.prompt)
  if (q.wordBank) {
    q.wordBank = q.wordBank.map((w) => safeStrip(w))
  }
  if (q.correctSentence) {
    q.correctSentence = safeStrip(q.correctSentence)
  }
  const opts = q.options
  if (!opts?.length) return

  const stripped = opts.map((o) => ({
    oldKey: String(o.key).trim(),
    text: stripLeadingOptionLabel(safeStrip(o.text)),
  }))
  const oldCorrect = q.correctKey?.trim()

  q.options = stripped.map((row, i) => ({
    key: optionLetter(i),
    text: row.text,
  }))

  if (!oldCorrect) return

  const lower = oldCorrect.toLowerCase()
  let byKeyExact = -1
  let byKeyCi = -1
  let byTextCi = -1
  for (let i = 0; i < stripped.length; i += 1) {
    const row = stripped[i]
    if (byKeyExact < 0 && row.oldKey === oldCorrect) byKeyExact = i
    if (byKeyCi < 0 && row.oldKey.toLowerCase() === lower) byKeyCi = i
    if (byTextCi < 0 && row.text.toLowerCase() === lower) byTextCi = i
  }
  const idx = byKeyExact >= 0 ? byKeyExact : byKeyCi >= 0 ? byKeyCi : byTextCi
  if (idx >= 0) {
    q.correctKey = optionLetter(idx)
  }
}

function resolveOldCorrectToIndex(oldCorrect: string, stripped: Array<{ oldKey: string; text: string }>): number {
  const trimmed = oldCorrect.trim()
  const lower = trimmed.toLowerCase()
  let byKeyExact = -1
  let byKeyCi = -1
  let byTextCi = -1
  for (let index = 0; index < stripped.length; index += 1) {
    const row = stripped[index]
    if (byKeyExact < 0 && row.oldKey === trimmed) byKeyExact = index
    if (byKeyCi < 0 && row.oldKey.toLowerCase() === lower) byKeyCi = index
    if (byTextCi < 0 && row.text.toLowerCase() === lower) byTextCi = index
  }
  return byKeyExact >= 0 ? byKeyExact : byKeyCi >= 0 ? byKeyCi : byTextCi
}

/** Правая колонка сопоставления: ключи → A,B,… и matchCorrectKeys. */
function normalizeMatchPairsQuestion(q: {
  prompt: string
  matchLeftItems?: string[]
  matchRightOptions?: Array<{ key: string; text: string }>
  matchCorrectKeys?: string[]
}): void {
  q.prompt = safeStrip(q.prompt)
  if (q.matchLeftItems) {
    q.matchLeftItems = q.matchLeftItems.map((stem) => safeStrip(stem))
  }
  const pairs = q.matchRightOptions
  if (!pairs?.length || !q.matchCorrectKeys?.length) return

  const stripped = pairs.map((option) => ({
    oldKey: String(option.key).trim(),
    text: stripLeadingOptionLabel(safeStrip(option.text)),
  }))
  const previousCorrectKeys = [...q.matchCorrectKeys]

  q.matchRightOptions = stripped.map((row, index) => ({
    key: optionLetter(index),
    text: row.text,
  }))

  const resolvedLetters: string[] = []
  for (const previousCorrect of previousCorrectKeys) {
    const index = resolveOldCorrectToIndex(previousCorrect, stripped)
    if (index >= 0) {
      resolvedLetters.push(optionLetter(index))
    }
  }
  q.matchCorrectKeys = resolvedLetters
}

/** Нормализация вариантов и набора correctKeys для checkbox. */
function normalizeCheckboxQuestion(q: {
  prompt: string
  options?: Array<{ key: string; text: string }>
  correctKeys?: string[]
  wordBank?: string[]
  correctSentence?: string
  gapTemplate?: string
  gapCorrectToken?: string
}): void {
  q.prompt = safeStrip(q.prompt)
  if (q.wordBank) {
    q.wordBank = q.wordBank.map((w) => safeStrip(w))
  }
  if (q.correctSentence) {
    q.correctSentence = safeStrip(q.correctSentence)
  }
  if (q.gapTemplate) {
    q.gapTemplate = safeStrip(q.gapTemplate)
  }
  if (q.gapCorrectToken) {
    q.gapCorrectToken = safeStrip(q.gapCorrectToken)
  }
  const opts = q.options
  if (!opts?.length) return

  const stripped = opts.map((option) => ({
    oldKey: String(option.key).trim(),
    text: stripLeadingOptionLabel(safeStrip(option.text)),
  }))
  const oldCorrectKeys = q.correctKeys?.length ? [...q.correctKeys] : []

  q.options = stripped.map((row, index) => ({
    key: optionLetter(index),
    text: row.text,
  }))

  if (oldCorrectKeys.length === 0) return

  const resolvedLetters: string[] = []
  for (const oldCorrect of oldCorrectKeys) {
    const index = resolveOldCorrectToIndex(oldCorrect, stripped)
    if (index >= 0) {
      resolvedLetters.push(optionLetter(index))
    }
  }
  q.correctKeys = [...new Set(resolvedLetters)]
}

/** Рекурсивно чистит строки и нормализует MCQ/select ключи. */
export function normalizeLessonSpecFromModel(spec: LessonSpecFromModel): LessonSpecFromModel {
  const out = structuredClone(spec) as LessonSpecFromModel
  out.title = safeStrip(out.title)
  if (out.subtitle) {
    out.subtitle = safeStrip(out.subtitle)
  }
  for (const part of out.parts) {
    part.title = safeStrip(part.title)
    for (const ex of part.exercises) {
      ex.title = safeStrip(ex.title)
      if (ex.instruction) ex.instruction = safeStrip(ex.instruction)
      if (ex.readingPassage) {
        const rp = ex.readingPassage
        if (rp.title) rp.title = safeStrip(rp.title)
        if (rp.instruction) rp.instruction = safeStrip(rp.instruction)
        rp.paragraphs = rp.paragraphs.map((p) => safeStrip(p))
      }
      const kind = ex.inputKind ?? 'radio'
      if (kind === 'checkbox') {
        for (const q of ex.questions) {
          normalizeCheckboxQuestion(q)
        }
      } else if (kind === 'matchPairs') {
        for (const q of ex.questions) {
          normalizeMatchPairsQuestion(q)
        }
      } else if (kind === 'radio' || kind === 'select') {
        for (const q of ex.questions) {
          normalizeMcqQuestion(q)
        }
      } else {
        for (const q of ex.questions) {
          q.prompt = safeStrip(q.prompt)
          if (q.wordBank) q.wordBank = q.wordBank.map((w) => safeStrip(w))
          if (q.correctSentence) q.correctSentence = safeStrip(q.correctSentence)
          if (q.gapTemplate) q.gapTemplate = safeStrip(q.gapTemplate)
          if (q.gapCorrectToken) q.gapCorrectToken = safeStrip(q.gapCorrectToken)
          if (q.gapCorrectTokens?.length) {
            q.gapCorrectTokens = q.gapCorrectTokens.map((token) => safeStrip(token))
          }
        }
      }
    }
  }
  return out
}
