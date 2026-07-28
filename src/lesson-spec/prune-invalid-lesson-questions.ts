import {
  LESSON_SPEC_VERSION,
  lessonSpecFromModelSchema,
  readingPassageSchema,
  type LessonSpecFromModel,
} from '@/src/lesson-spec/schema'
import { coerceGapInLessonSpecJson } from '@/src/lesson-spec/coerce-gap-lesson-spec'
import { coerceMcqInLessonSpecJson } from '@/src/lesson-spec/coerce-mcq-lesson-spec'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function safeTitle(s: unknown, fallback: string, max: number): string {
  if (typeof s !== 'string') return fallback
  const t = s.trim()
  if (t.length === 0) return fallback
  return t.length > max ? t.slice(0, max) : t
}

function exerciseBaseForProbe(ex: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(ex)) {
    if (k === 'questions' || k === 'title') continue
    out[k] = val
  }
  out.title = safeTitle(ex.title, 'Задание', 500)
  const rp = ex.readingPassage
  if (isRecord(rp)) {
    const parsed = readingPassageSchema.safeParse(rp)
    if (parsed.success) {
      out.readingPassage = parsed.data
    } else {
      delete out.readingPassage
    }
  }
  return out
}

function buildSingleQuestionProbe(
  root: Record<string, unknown>,
  partTitle: string,
  exBase: Record<string, unknown>,
  q: Record<string, unknown>,
): unknown {
  const probe: Record<string, unknown> = {
    version: LESSON_SPEC_VERSION,
    title: safeTitle(root.title, 'тест', 500),
    parts: [
      {
        title: safeTitle(partTitle, 'Часть', 500),
        exercises: [{ ...exBase, questions: [q] }],
      },
    ],
  }
  const sub = root.subtitle
  if (typeof sub === 'string' && sub.trim()) {
    probe.subtitle = sub.trim().slice(0, 1000)
  }
  const gf = root.googleFontsHref
  if (typeof gf === 'string' && /^https:\/\/fonts\.googleapis\.com\/css2/i.test(gf)) {
    probe.googleFontsHref = gf.slice(0, 2000)
  }
  return probe
}

function validateQuestionProbe(
  root: Record<string, unknown>,
  partTitle: string,
  ex: Record<string, unknown>,
  q: Record<string, unknown>,
): { ok: true } | { ok: false; issues: string } {
  const exBase = exerciseBaseForProbe(ex)
  const probe = buildSingleQuestionProbe(root, partTitle, exBase, q)
  const r = lessonSpecFromModelSchema.safeParse(probe)
  if (r.success) return { ok: true }
  return { ok: false, issues: r.error.issues.map((i) => i.message).join('; ') }
}

function coerceRootFieldsForFinalParse(clone: Record<string, unknown>): void {
  clone.version = LESSON_SPEC_VERSION
  clone.title = safeTitle(clone.title, 'тест', 500)
  const sub = clone.subtitle
  if (sub !== undefined && (typeof sub !== 'string' || !sub.trim())) {
    delete clone.subtitle
  } else if (typeof sub === 'string' && sub.trim()) {
    clone.subtitle = sub.trim().slice(0, 1000)
  }
  const gf = clone.googleFontsHref
  if (gf !== undefined) {
    if (typeof gf !== 'string' || !/^https:\/\/fonts\.googleapis\.com\/css2/i.test(gf)) {
      delete clone.googleFontsHref
    } else {
      clone.googleFontsHref = gf.slice(0, 2000)
    }
  }
  const parts = clone.parts
  if (!Array.isArray(parts)) return
  for (const p of parts) {
    if (!isRecord(p)) continue
    p.title = safeTitle(p.title, 'Часть', 500)
    const exs = p.exercises
    if (!Array.isArray(exs)) continue
    for (const ex of exs) {
      if (!isRecord(ex)) continue
      ex.title = safeTitle(ex.title, 'Задание', 500)
    }
  }
}

/**
 * Удаляет вопросы/упражнения/части, не проходящие lessonSpecFromModelSchema.
 * Возвращает данные для parse или null, если не осталось ни одной валидной части.
 */
export function pruneLooseLessonSpecToValidModel(
  loose: unknown,
): { model: LessonSpecFromModel; warnings: string[] } | null {
  if (!isRecord(loose)) return null
  const clone = structuredClone(loose) as Record<string, unknown>
  coerceMcqInLessonSpecJson(clone)
  coerceGapInLessonSpecJson(clone)

  const direct = lessonSpecFromModelSchema.safeParse(clone)
  if (direct.success) {
    return { model: direct.data, warnings: [] }
  }

  const parts = clone.parts
  if (!Array.isArray(parts)) return null

  const warnings: string[] = []
  const rootForProbe = clone

  const newParts: unknown[] = []
  for (let pi = 0; pi < parts.length; pi += 1) {
    const part = parts[pi]
    if (!isRecord(part)) continue
    const partTitle = typeof part.title === 'string' ? part.title : `часть ${pi + 1}`
    const exercises = part.exercises
    if (!Array.isArray(exercises)) continue

    const newExercises: unknown[] = []
    for (let ei = 0; ei < exercises.length; ei += 1) {
      const ex = exercises[ei]
      if (!isRecord(ex)) continue
      const qs = ex.questions
      if (!Array.isArray(qs)) continue
      const kept: unknown[] = []
      for (let qi = 0; qi < qs.length; qi += 1) {
        const q = qs[qi]
        if (!isRecord(q)) continue
        const probe = validateQuestionProbe(rootForProbe, partTitle, ex, q)
        if (probe.ok) {
          kept.push(q)
        } else {
          const qid = typeof q.id === 'string' ? q.id : 'без id'
          const exTitle = typeof ex.title === 'string' ? ex.title : `упражнение ${ei + 1}`
          warnings.push(
            `Часть «${partTitle}», задание «${exTitle}», вопрос «${qid}»: ${probe.issues}`,
          )
        }
      }
      if (kept.length > 0) {
        newExercises.push({ ...ex, questions: kept })
      }
    }

    if (newExercises.length > 0) {
      newParts.push({ ...part, exercises: newExercises })
    }
  }

  if (newParts.length === 0) return null

  clone.parts = newParts
  coerceRootFieldsForFinalParse(clone)

  const out = lessonSpecFromModelSchema.safeParse(clone)
  if (!out.success) return null
  return { model: out.data, warnings }
}
