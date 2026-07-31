import type { CandidateKind, CandidateOption, ExtractedCandidate, ExtractionResult } from './types'

/**
 * Детерминированное извлечение готовых заданий из текста/PDF («extract-first»).
 * НИЧЕГО не выдумывает: распознаёт только то, что явно присутствует.
 */

const TRUE_TOKENS = new Set(['true', 't', 'верно', 'да', 'yes'])
const FALSE_TOKENS = new Set(['false', 'f', 'неверно', 'нет', 'no'])

const ANSWER_HEADING_RE =
  /^\s*(answers?|answer\s*key|ответы|ключи?|правильные\s+ответы)\s*[:.]?\s*$/i
const NUMBERED_LINE_RE = /^\s*(\d{1,3})\s*[.)\-]\s+(.*)$/
const OPTION_LINE_RE = /^\s*([A-Ha-h])\s*[.):]\s+(.+)$/
const GAP_RE = /_{3,}/
const BRACKET_VERB_RE = /\((?:not\s+)?(?:to\s+)?[a-zA-Z][^)]*\)/

function normalizeGapMarkers(text: string): string {
  return text.replace(/_{3,}/g, '___')
}

function isMeaningfulCandidate(candidate: ExtractedCandidate): boolean {
  const letters = candidate.prompt.replace(/_{2,}/g, ' ').match(/\p{L}/gu)
  return (letters?.length ?? 0) >= 6
}

function hasBracketVerb(text: string): boolean {
  return BRACKET_VERB_RE.test(text)
}

const INLINE_NUMBER_RE = /(\d{1,3})\.\s+/g

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function isTrueFalseOptions(options: CandidateOption[]): boolean {
  if (options.length !== 2) return false
  const values = options.map((option) => option.text.trim().toLowerCase())
  const hasTrue = values.some((value) => TRUE_TOKENS.has(value))
  const hasFalse = values.some((value) => FALSE_TOKENS.has(value))
  return hasTrue && hasFalse
}

function parseAnswerKey(lines: string[]): { answers: Map<number, string>; keyStartLine: number } {
  let keyStartLine = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (ANSWER_HEADING_RE.test(lines[index])) {
      keyStartLine = index
      break
    }
  }
  const answers = new Map<number, string>()
  if (keyStartLine < 0) return { answers, keyStartLine }

  const entryRe = /(\d{1,3})\s*[.)\-:]\s*(неверно|верно|true|false|да|нет|yes|no|[A-Ha-h])(?=[\s.,;)]|$)/gi
  for (let index = keyStartLine + 1; index < lines.length; index += 1) {
    let match: RegExpExecArray | null
    entryRe.lastIndex = 0
    while ((match = entryRe.exec(lines[index])) !== null) {
      const number = Number.parseInt(match[1], 10)
      if (Number.isFinite(number)) answers.set(number, match[2].trim())
    }
  }
  return { answers, keyStartLine }
}

function splitNumberedBlocks(
  lines: string[],
): Array<{ number: number; lines: string[]; startIndex: number }> {
  const blocks: Array<{ number: number; lines: string[]; startIndex: number }> = []
  let current: { number: number; lines: string[]; startIndex: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = NUMBERED_LINE_RE.exec(line)
    if (match) {
      if (current) blocks.push(current)
      current = { number: Number.parseInt(match[1], 10), lines: [match[2]], startIndex: index }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push(current)
  return blocks
}

/** Разбивает текст с inline-нумерацией «1. … 2. … 3. …» на сегменты. */
function splitInlineNumberedSegments(
  bodyText: string,
): Array<{ number: number; text: string; startIndex: number }> {
  const normalized = bodyText.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const matches = [...normalized.matchAll(INLINE_NUMBER_RE)]
  if (matches.length === 0) return []

  const segments: Array<{ number: number; text: string; startIndex: number }> = []
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const number = Number.parseInt(match[1], 10)
    const start = match.index! + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index! : normalized.length
    const text = normalized.slice(start, end).trim()
    if (text.length > 0) {
      segments.push({ number, text, startIndex: match.index ?? 0 })
    }
  }
  return segments
}

function resolveAnswer(
  raw: string | undefined,
  kind: CandidateKind,
  options: CandidateOption[],
): string | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (kind === 'trueFalse') {
    if (TRUE_TOKENS.has(value)) return 'true'
    if (FALSE_TOKENS.has(value)) return 'false'
    return null
  }
  const byLabel = options.find((option) => option.label.trim().toLowerCase() === value)
  if (byLabel) return byLabel.label
  return null
}

function buildMcqOrTrueFalse(
  blockLines: string[],
): { kind: CandidateKind; prompt: string; options: CandidateOption[] } | null {
  const optionIndices: number[] = []
  const options: CandidateOption[] = []
  for (let index = 0; index < blockLines.length; index += 1) {
    const match = OPTION_LINE_RE.exec(blockLines[index])
    if (match) {
      optionIndices.push(index)
      options.push({ label: match[1].toUpperCase(), text: match[2].trim() })
    }
  }
  if (options.length < 2) return null
  const firstOption = optionIndices[0]
  const prompt = blockLines.slice(0, firstOption).join(' ').trim()
  const kind: CandidateKind = isTrueFalseOptions(options) ? 'trueFalse' : 'mcq'
  return { kind, prompt: prompt.length > 0 ? prompt : blockLines[0].trim(), options }
}

function extractBracketAnswer(bracketContent: string): string {
  const trimmed = bracketContent.trim()
  const notToMatch = /^not\s+to\s+(.+)$/i.exec(trimmed)
  if (notToMatch) return `not ${notToMatch[1].trim()}`
  const notMatch = /^not\s+(.+)$/i.exec(trimmed)
  if (notMatch) return `not ${notMatch[1].trim()}`
  const toMatch = /^to\s+(.+)$/i.exec(trimmed)
  if (toMatch) return toMatch[1].trim()
  return trimmed
}

function firstBracketContent(text: string): string | null {
  const match = /\(([^)]+)\)/.exec(text)
  return match ? match[1].trim() : null
}

function pushCandidateFromSegment(input: {
  number: number
  text: string
  startIndex: number
  answers: Map<number, string>
  candidates: ExtractedCandidate[]
}): void {
  const lines = input.text.split('\n')
  const mcq = buildMcqOrTrueFalse(lines)
  if (mcq) {
    input.candidates.push({
      kind: mcq.kind,
      prompt: mcq.prompt,
      options: mcq.options,
      answer: resolveAnswer(input.answers.get(input.number), mcq.kind, mcq.options),
      sourceIndex: input.startIndex,
    })
    return
  }

  if (GAP_RE.test(input.text)) {
    input.candidates.push({
      kind: 'gap',
      prompt: normalizeGapMarkers(input.text.replace(/\s+/g, ' ').trim()),
      options: [],
      answer: input.answers.get(input.number)?.trim() ?? null,
      sourceIndex: input.startIndex,
    })
    return
  }

  if (hasBracketVerb(input.text)) {
    const bracket = firstBracketContent(input.text)
    input.candidates.push({
      kind: 'bracketGap',
      prompt: normalizeGapMarkers(input.text.replace(/\s+/g, ' ').trim()),
      options: [],
      answer: bracket ? extractBracketAnswer(bracket) : null,
      sourceIndex: input.startIndex,
    })
  }
}

export function extractCandidates(rawText: string): ExtractionResult {
  const text = normalize(rawText)
  const allLines = text.split('\n')

  const { answers, keyStartLine } = parseAnswerKey(allLines)
  const bodyLines = keyStartLine >= 0 ? allLines.slice(0, keyStartLine) : allLines
  const bodyText = bodyLines.join('\n')

  const candidates: ExtractedCandidate[] = []
  const seenNumbers = new Set<number>()

  const inlineSegments = splitInlineNumberedSegments(bodyText)
  for (const segment of inlineSegments) {
    if (seenNumbers.has(segment.number)) continue
    const before = candidates.length
    pushCandidateFromSegment({
      number: segment.number,
      text: segment.text,
      startIndex: segment.startIndex,
      answers,
      candidates,
    })
    if (candidates.length > before) {
      seenNumbers.add(segment.number)
    }
  }

  if (candidates.length === 0) {
    const blocks = splitNumberedBlocks(bodyLines)
    for (const block of blocks) {
      if (seenNumbers.has(block.number)) continue
      const blockText = block.lines.join('\n').trim()
      if (!blockText) continue
      const before = candidates.length
      pushCandidateFromSegment({
        number: block.number,
        text: blockText,
        startIndex: block.startIndex,
        answers,
        candidates,
      })
      if (candidates.length > before) {
        seenNumbers.add(block.number)
      }
    }
  }

  if (candidates.length === 0) {
    for (let index = 0; index < bodyLines.length; index += 1) {
      const line = bodyLines[index].trim()
      if (line.length > 0 && GAP_RE.test(line)) {
        candidates.push({
          kind: 'gap',
          prompt: normalizeGapMarkers(line),
          options: [],
          answer: null,
          sourceIndex: index,
        })
      }
    }
  }

  candidates.sort((left, right) => left.sourceIndex - right.sourceIndex)

  const filtered = candidates.filter(isMeaningfulCandidate)

  return {
    candidates: filtered,
    hasReadyExercises: filtered.length >= 1,
  }
}
