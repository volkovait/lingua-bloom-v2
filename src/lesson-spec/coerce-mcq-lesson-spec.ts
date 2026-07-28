/**
 * До Zod: восстанавливает options для radio/select, если модель положила варианты в prompt
 * (часто при генерации из PDF).
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isOptionRow(v: unknown): v is { key: string; text: string } {
  if (!isRecord(v)) return false
  return typeof v.key === 'string' && typeof v.text === 'string' && v.key.length > 0 && v.text.length > 0
}

function countValidOptions(q: Record<string, unknown>): number {
  if (!Array.isArray(q.options)) return 0
  let n = 0
  for (const v of q.options) {
    if (isOptionRow(v)) n += 1
  }
  return n
}

/** A) / a. / B: в начале строки */
function inferLetterLabeledOptions(prompt: string): { stem: string; options: Array<{ key: string; text: string }> } | null {
  const re = /(?:^|\n)([^\S\n\r]*)([A-Ha-h])\s*[\).:]\s*([^\n\r]+)/gm
  const hits: Array<{ idx: number; letter: string; text: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(prompt)) !== null) {
    const text = m[3].trim()
    if (!text) continue
    hits.push({ idx: m.index, letter: m[2].toUpperCase(), text })
  }
  if (hits.length < 2) return null
  hits.sort((a, b) => a.idx - b.idx)
  const firstIdx = hits[0].idx
  const stem = prompt.slice(0, firstIdx).replace(/\s+$/u, '').trim()
  const options = hits.map((h) => ({
    key: h.letter,
    text: h.text,
  }))
  return {
    stem: stem.length > 0 ? stem : 'Выберите правильный вариант.',
    options,
  }
}

/** 1) / 2. в начале строки (если нет буквенных меток) */
function inferNumberedLineOptions(prompt: string): { stem: string; options: Array<{ key: string; text: string }> } | null {
  const re = /(?:^|\n)([^\S\n\r]*)(\d{1,2})\s*[\).:]\s*([^\n\r]+)/gm
  const hits: Array<{ idx: number; n: number; text: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(prompt)) !== null) {
    const n = Number.parseInt(m[2], 10)
    if (!Number.isFinite(n) || n < 1 || n > 40) continue
    const text = m[3].trim()
    if (text.length < 2) continue
    hits.push({ idx: m.index, n, text })
  }
  if (hits.length < 2) return null
  hits.sort((a, b) => a.idx - b.idx)
  const nums = hits.map((h) => h.n)
  const strictlyIncreasing =
    new Set(nums).size === nums.length &&
    nums.every((v, i) => i === 0 || v === nums[i - 1]! + 1)
  if (!strictlyIncreasing) return null
  const firstIdx = hits[0].idx
  const stem = prompt.slice(0, firstIdx).replace(/\s+$/u, '').trim()
  const options = hits.map((h) => ({
    key: String(h.n),
    text: h.text,
  }))
  return {
    stem: stem.length > 0 ? stem : 'Выберите правильный вариант.',
    options,
  }
}

/** Склейки вида (is / are / am) в тексте задания */
function inferParenSlashOptions(prompt: string): { stem: string; options: Array<{ key: string; text: string }> } | null {
  const re = /\(([^()\n]{1,240})\)/gu
  let best: { start: number; end: number; parts: string[] } | null = null
  for (const m of prompt.matchAll(re)) {
    const inner = m[1]
    if (!inner.includes('/')) continue
    const parts = inner
      .split(/\s*\/\s*/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 120)
    if (parts.length < 2 || parts.length > 8) continue
    if (!parts.every((p) => /^[\p{L}\p{N}'’´`.,!?:\- ]+$/u.test(p))) continue
    const start = m.index ?? 0
    const end = start + m[0].length
    best = { start, end, parts }
    break
  }
  if (!best) return null
  const stem = `${prompt.slice(0, best.start).trim()} _____ ${prompt.slice(best.end).trim()}`.replace(/\s+/gu, ' ').trim()
  const options = best.parts.map((text, i) => ({
    key: String.fromCharCode(65 + i),
    text,
  }))
  return {
    stem: stem.length > 0 ? stem : 'Выберите правильный вариант.',
    options,
  }
}

/** Первая подходящая строка «a / b / c» (без скобок); stem — остальной текст. */
function inferSlashListLineInText(text: string): { stem: string; options: Array<{ key: string; text: string }> } | null {
  const lines = text.split(/\n/)
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li].trim()
    if (!line.includes('/') || line.length > 400) continue
    if (/https?:\/\//i.test(line)) continue
    const parts = line
      .split(/\s*\/\s*/u)
      .map((s) => s.trim().replace(/[,;:.]$/u, '').trim())
      .filter((s) => s.length > 0)
    if (parts.length < 2 || parts.length > 10) continue
    if (parts.some((p) => p.length < 2 || p.length > 80)) continue
    if (!parts.every((p) => /\p{L}/u.test(p))) continue
    if (!parts.every((p) => /^[\p{L}\p{N}'’´`.,!?:\- ]+$/u.test(p))) continue
    const wordCounts = parts.map((p) => p.split(/\s+/u).length)
    if (wordCounts.some((n) => n > 6)) continue
    const options = parts.map((t, i) => ({
      key: String.fromCharCode(65 + i),
      text: t,
    }))
    const stem = lines.filter((_, i) => i !== li).join('\n').trim()
    return {
      stem: stem.length > 0 ? stem : 'Выберите правильный вариант.',
      options,
    }
  }
  return null
}

function inferMcqFromPrompt(prompt: string): { stem: string; options: Array<{ key: string; text: string }> } | null {
  const letter = inferLetterLabeledOptions(prompt)
  if (letter) return letter
  const slash = inferSlashListLineInText(prompt)
  if (slash) return slash
  const numbered = inferNumberedLineOptions(prompt)
  if (numbered) return numbered
  return inferParenSlashOptions(prompt)
}

/** Для контекста упражнения: без нумерованных строк (часто «1.» в инструкции — не варианты). */
function inferSharedMcqOptionsFromExerciseHint(text: string): Array<{ key: string; text: string }> | null {
  const letter = inferLetterLabeledOptions(text)
  if (letter && letter.options.length >= 2) {
    return letter.options.map((o) => ({ key: o.key, text: o.text }))
  }
  const paren = inferParenSlashOptions(text)
  if (paren && paren.options.length >= 2) {
    return paren.options.map((o) => ({ key: o.key, text: o.text }))
  }
  const slash = inferSlashListLineInText(text)
  if (slash && slash.options.length >= 2) {
    return slash.options.map((o) => ({ key: o.key, text: o.text }))
  }
  return null
}

const CORRECT_KEY_ALIASES = ['correctAnswer', 'rightAnswer', 'answer'] as const

function coerceCorrectKeyAlias(q: Record<string, unknown>): void {
  const ck = q.correctKey
  if (typeof ck === 'string' && ck.trim().length > 0) return
  for (const k of CORRECT_KEY_ALIASES) {
    const v = q[k]
    if (typeof v === 'string' && v.trim().length > 0) {
      q.correctKey = v.trim()
      return
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      q.correctKey = String(v)
      return
    }
  }
}

/**
 * Только короткие служебные поля упражнения — не целиком readingPassage.paragraphs.
 * Иначе эвристики «строка с /» из учебного текста ошибочно становятся общими options
 * для всех вопросов (ломает явный true/false и другие форматы).
 */
function buildExerciseMcqHintText(ex: Record<string, unknown>): string {
  const chunks: string[] = []
  if (typeof ex.title === 'string' && ex.title.trim()) chunks.push(ex.title.trim())
  if (typeof ex.instruction === 'string' && ex.instruction.trim()) chunks.push(ex.instruction.trim())
  const rp = ex.readingPassage
  if (isRecord(rp)) {
    if (typeof rp.title === 'string' && rp.title.trim()) chunks.push(rp.title.trim())
    if (typeof rp.instruction === 'string' && rp.instruction.trim()) chunks.push(rp.instruction.trim())
  }
  return chunks.join('\n')
}

function coerceQuestionMcq(q: Record<string, unknown>): void {
  if (typeof q.prompt !== 'string') return
  if (countValidOptions(q) >= 2) return
  const inferred = inferMcqFromPrompt(q.prompt)
  if (!inferred) return
  q.prompt = inferred.stem
  q.options = inferred.options
}

/** Мутирует объект после JSON.parse: заполняет options у вопросов radio/select. */
export function coerceMcqInLessonSpecJson(value: unknown): void {
  if (!isRecord(value)) return
  const parts = value.parts
  if (!Array.isArray(parts)) return
  for (const part of parts) {
    if (!isRecord(part)) continue
    const exercises = part.exercises
    if (!Array.isArray(exercises)) continue
    for (const ex of exercises) {
      if (!isRecord(ex)) continue
      if (ex.inputKind === 'wordOrder' || ex.inputKind === 'gapFill' || ex.inputKind === 'gapDrag' || ex.inputKind === 'matchPairs') continue
      const questions = ex.questions
      if (!Array.isArray(questions)) continue
      for (const q of questions) {
        if (!isRecord(q)) continue
        coerceQuestionMcq(q)
      }
      const hint = buildExerciseMcqHintText(ex)
      const shared = hint.length > 0 ? inferSharedMcqOptionsFromExerciseHint(hint) : null
      if (shared) {
        for (const q of questions) {
          if (!isRecord(q)) continue
          if (countValidOptions(q) >= 2) continue
          q.options = shared.map((o) => ({ key: o.key, text: o.text }))
        }
      }
      for (const q of questions) {
        if (!isRecord(q)) continue
        coerceCorrectKeyAlias(q)
      }
    }
  }
}
