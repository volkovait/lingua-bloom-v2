import type { CandidateKind, CandidateOption, ExtractedCandidate, ExtractionResult } from './types'

/**
 * Детерминированное извлечение готовых заданий из текста/PDF («extract-first»).
 * НИЧЕГО не выдумывает: распознаёт только то, что явно присутствует.
 *
 * Поддержано:
 *  - нумерованные вопросы: «1. … ?», «1) …», «2 - …»
 *  - MCQ-варианты: «A) …», «b. …», «C: …» (2–8 штук)
 *  - пропуски: предложения с «___» / «_____»
 *  - true/false: варианты вида true/false, верно/неверно, да/нет
 *  - секция ответов: «Answers/Ответы/Ключи» с картой «номер → ответ»
 */

const TRUE_TOKENS = new Set(['true', 't', 'верно', 'да', 'yes'])
const FALSE_TOKENS = new Set(['false', 'f', 'неверно', 'нет', 'no'])

const ANSWER_HEADING_RE =
  /^\s*(answers?|answer\s*key|ответы|ключи?|правильные\s+ответы)\s*[:.]?\s*$/i
const NUMBERED_LINE_RE = /^\s*(\d{1,3})\s*[.)\-]\s+(.*)$/
const OPTION_LINE_RE = /^\s*([A-Ha-h])\s*[.):]\s+(.+)$/
const GAP_RE = /_{3,}/

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function isTrueFalseOptions(options: CandidateOption[]): boolean {
  if (options.length !== 2) return false
  const values = options.map((o) => o.text.trim().toLowerCase())
  const hasTrue = values.some((v) => TRUE_TOKENS.has(v))
  const hasFalse = values.some((v) => FALSE_TOKENS.has(v))
  return hasTrue && hasFalse
}

/** Парсит секцию ответов в карту «номер вопроса → строка ответа». */
function parseAnswerKey(lines: string[]): { answers: Map<number, string>; keyStartLine: number } {
  let keyStartLine = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (ANSWER_HEADING_RE.test(lines[i])) {
      keyStartLine = i
      break
    }
  }
  const answers = new Map<number, string>()
  if (keyStartLine < 0) return { answers, keyStartLine }

  // Без \b в конце: он не срабатывает после кириллицы (ASCII-граница слова).
  const entryRe = /(\d{1,3})\s*[.)\-:]\s*(неверно|верно|true|false|да|нет|yes|no|[A-Ha-h])(?=[\s.,;)]|$)/gi
  for (let i = keyStartLine + 1; i < lines.length; i += 1) {
    let m: RegExpExecArray | null
    entryRe.lastIndex = 0
    while ((m = entryRe.exec(lines[i])) !== null) {
      const n = Number.parseInt(m[1], 10)
      if (Number.isFinite(n)) answers.set(n, m[2].trim())
    }
  }
  return { answers, keyStartLine }
}

/** Разбивает тело на блоки по нумерованным маркерам. */
function splitNumberedBlocks(
  lines: string[],
): Array<{ number: number; lines: string[]; startIndex: number }> {
  const blocks: Array<{ number: number; lines: string[]; startIndex: number }> = []
  let current: { number: number; lines: string[]; startIndex: number } | null = null
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const m = NUMBERED_LINE_RE.exec(line)
    if (m) {
      if (current) blocks.push(current)
      current = { number: Number.parseInt(m[1], 10), lines: [m[2]], startIndex: i }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push(current)
  return blocks
}

/** Нормализует ответ из ключа к метке варианта (A/B/…) либо к true/false. */
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
  // MCQ: ключ по метке варианта (без учёта регистра).
  const byLabel = options.find((o) => o.label.trim().toLowerCase() === value)
  if (byLabel) return byLabel.label
  return null
}

function buildMcqOrTrueFalse(
  blockLines: string[],
): { kind: CandidateKind; prompt: string; options: CandidateOption[] } | null {
  const optionIndices: number[] = []
  const options: CandidateOption[] = []
  for (let i = 0; i < blockLines.length; i += 1) {
    const m = OPTION_LINE_RE.exec(blockLines[i])
    if (m) {
      optionIndices.push(i)
      options.push({ label: m[1].toUpperCase(), text: m[2].trim() })
    }
  }
  if (options.length < 2) return null
  const firstOption = optionIndices[0]
  const prompt = blockLines.slice(0, firstOption).join(' ').trim()
  const kind: CandidateKind = isTrueFalseOptions(options) ? 'trueFalse' : 'mcq'
  return { kind, prompt: prompt.length > 0 ? prompt : blockLines[0].trim(), options }
}

export function extractCandidates(rawText: string): ExtractionResult {
  const text = normalize(rawText)
  const allLines = text.split('\n')

  const { answers, keyStartLine } = parseAnswerKey(allLines)
  const bodyLines = keyStartLine >= 0 ? allLines.slice(0, keyStartLine) : allLines

  const candidates: ExtractedCandidate[] = []
  const blocks = splitNumberedBlocks(bodyLines)

  if (blocks.length >= 1) {
    for (const block of blocks) {
      const blockText = block.lines.join('\n').trim()
      if (!blockText) continue

      const mcq = buildMcqOrTrueFalse(block.lines)
      if (mcq) {
        candidates.push({
          kind: mcq.kind,
          prompt: mcq.prompt,
          options: mcq.options,
          answer: resolveAnswer(answers.get(block.number), mcq.kind, mcq.options),
          sourceIndex: block.startIndex,
        })
        continue
      }

      if (GAP_RE.test(blockText)) {
        candidates.push({
          kind: 'gap',
          prompt: block.lines.join(' ').replace(/\s+/g, ' ').trim(),
          options: [],
          answer: answers.get(block.number)?.trim() ?? null,
          sourceIndex: block.startIndex,
        })
      }
    }
  }

  // Fallback: отдельные предложения с пропусками без нумерации.
  if (candidates.length === 0) {
    for (let i = 0; i < bodyLines.length; i += 1) {
      const line = bodyLines[i].trim()
      if (line.length > 0 && GAP_RE.test(line)) {
        candidates.push({
          kind: 'gap',
          prompt: line,
          options: [],
          answer: null,
          sourceIndex: i,
        })
      }
    }
  }

  return {
    candidates,
    hasReadyExercises: candidates.length >= 2,
  }
}
