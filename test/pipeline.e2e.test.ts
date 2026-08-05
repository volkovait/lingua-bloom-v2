import { readFileSync } from 'node:fs'
import path from 'node:path'

import { Command, MemorySaver } from '@langchain/langgraph'
import { describe, expect, it } from 'vitest'

import { extractCandidates } from '@/src/extract/candidates'
import { extractPdfText } from '@/src/extract/pdf'
import { countQuestionsInLessonSpec } from '@/src/lesson-spec/count-lesson-questions'
import { lessonSpecSchema, type LessonSpec } from '@/src/lesson-spec/schema'
import { buildGraphInvokeConfig } from '@/src/llm/tracing'
import { buildGenerationGraph, type GraphDeps } from '@/src/supervisor/graph'
import type { GenerationState } from '@/src/supervisor/state'

const DATA_DIR = path.resolve(process.cwd(), 'tesing-data')
const hasLlmKey = Boolean(
  process.env.OPENAI_API_KEY || process.env.POLZA_AI_API_KEY || process.env.POLZA_API_KEY,
)

// Живой прогон требует ключ LLM (OPENAI_* или POLZA_*). Без ключа — пропускаем.
const suite = hasLlmKey ? describe : describe.skip

function readPdf(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(DATA_DIR, name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

function makeInitial(partial: Partial<GenerationState>): GenerationState {
  return {
    userId: 'test-user',
    runId: 'test-run',
    threadId: 'test-thread',
    title: 'Тест',
    material: '',
    sourceType: 'text',
    mode: 'ready_material',
    materialIntent: 'generate_from_content',
    correctAnswersHint: '',
    autoSolveRequested: false,
    materialRelevant: true,
    relevanceMessage: '',
    planDraft: '',
    parts: [],
    specJson: null,
    validationWarnings: [],
    autoSolveDisclaimer: '',
    htmlBody: null,
    lessonId: null,
    phase: 'init',
    errorCode: '',
    errorMessage: '',
    messages: [],
    ...partial,
  }
}

type Captured = { spec: LessonSpec; htmlBody: string } | null

function buildTestGraph(): { graph: ReturnType<typeof buildGenerationGraph>; getSaved: () => Captured } {
  let saved: Captured = null
  const deps: GraphDeps = {
    checkpointer: new MemorySaver(),
    emit: async () => {},
    saveLesson: async (payload) => {
      saved = { spec: payload.spec, htmlBody: payload.htmlBody }
      return 'lesson-test-id'
    },
    updateRun: async () => {},
  }
  return { graph: buildGenerationGraph(deps), getSaved: () => saved }
}

function collectInputKinds(spec: LessonSpec): Set<string> {
  return new Set(spec.parts.flatMap((part) => part.exercises.map((exercise) => exercise.inputKind ?? 'radio')))
}

/** Прогоняет граф до конца, автоматически проходя HITL-паузы (план — принять, ответы — авто). */
async function driveToEnd(
  graph: ReturnType<typeof buildGenerationGraph>,
  initial: GenerationState,
  threadId: string,
): Promise<GenerationState> {
  const config = buildGraphInvokeConfig({
    threadId,
    runId: initial.runId || 'e2e-run',
    userId: initial.userId || 'e2e-user',
    recursionLimit: 100,
    tags: ['e2e'],
  })
  let result = (await graph.invoke(initial, config)) as GenerationState & {
    __interrupt__?: Array<{ value: { type?: string } }>
  }
  let guard = 0
  while (Array.isArray(result.__interrupt__) && result.__interrupt__.length > 0 && guard < 5) {
    guard += 1
    const value = result.__interrupt__[0]!.value
    const resume = value?.type === 'answers' ? { autoSolve: true } : { editedPlanMarkdown: '' }
    result = (await graph.invoke(new Command({ resume }), config)) as typeof result
  }
  return result
}

suite('supervisor pipeline (реальный LLM)', () => {
  it(
    'extract-first: grammar-PDF → reproduce без лишних вопросов',
    async () => {
      const material = await extractPdfText(readPdf('1_page.pdf'))
      const { candidates } = extractCandidates(material)
      expect(candidates.length).toBeGreaterThan(0)

      const { graph, getSaved } = buildTestGraph()
      const state = await driveToEnd(
        graph,
        makeInitial({
          runId: 'e2e-pdf',
          threadId: 'e2e-pdf',
          title: 'Progress Test 2',
          material,
          sourceType: 'pdf',
          autoSolveRequested: true,
        }),
        'e2e-pdf',
      )

      expect(state.errorCode).toBe('')
      expect(state.materialIntent).toBe('reproduce_test')
      expect(state.lessonId).toBe('lesson-test-id')
      const saved = getSaved()
      expect(saved).not.toBeNull()
      expect(lessonSpecSchema.safeParse(saved!.spec).success).toBe(true)
      expect(saved!.spec.parts.length).toBeGreaterThan(0)
      expect(countQuestionsInLessonSpec(saved!.spec)).toBeLessThanOrEqual(candidates.length)
      expect(collectInputKinds(saved!.spec).size).toBeLessThanOrEqual(2)
      expect(saved!.htmlBody).toContain('<!DOCTYPE html>')
      expect(saved!.htmlBody).toContain('lesson-spec')
    },
    240_000,
  )

  it(
    'raw-материал: «раскройте скобки» → reproduce, ≥10 gapFill, без лишних типов',
    async () => {
      const material = readFileSync(path.join(DATA_DIR, 'raw.txt'), 'utf8')
      const { candidates } = extractCandidates(material)
      expect(candidates.length).toBeGreaterThanOrEqual(10)

      const { graph, getSaved } = buildTestGraph()
      const state = await driveToEnd(
        graph,
        makeInitial({
          runId: 'e2e-raw',
          threadId: 'e2e-raw',
          title: 'Present/Past Simple',
          material,
          sourceType: 'text',
          autoSolveRequested: true,
        }),
        'e2e-raw',
      )

      expect(state.errorCode).toBe('')
      expect(state.materialIntent).toBe('reproduce_test')
      expect(state.lessonId).toBe('lesson-test-id')
      const saved = getSaved()
      expect(saved).not.toBeNull()
      expect(lessonSpecSchema.safeParse(saved!.spec).success).toBe(true)
      expect(saved!.spec.parts.length).toBeGreaterThan(0)
      expect(countQuestionsInLessonSpec(saved!.spec)).toBeGreaterThanOrEqual(10)
      expect(countQuestionsInLessonSpec(saved!.spec)).toBeLessThanOrEqual(candidates.length)
      const kinds = collectInputKinds(saved!.spec)
      expect(kinds.size).toBeLessThanOrEqual(2)
      expect(kinds.has('gapFill')).toBe(true)
      expect(kinds.has('matchPairs')).toBe(false)
      expect(kinds.has('wordOrder')).toBe(false)
    },
    240_000,
  )
})
