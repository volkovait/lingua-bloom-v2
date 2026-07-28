import { readFileSync } from 'node:fs'
import path from 'node:path'

import { Command, MemorySaver } from '@langchain/langgraph'
import { describe, expect, it } from 'vitest'

import { extractPdfText } from '@/src/extract/pdf'
import { lessonSpecSchema, type LessonSpec } from '@/src/lesson-spec/schema'
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
    ...partial,
  }
}

type Captured = { spec: LessonSpec; htmlBody: string } | null

function buildTestGraph(): { graph: ReturnType<typeof buildGenerationGraph>; getSaved: () => Captured } {
  let saved: Captured = null
  const deps: GraphDeps = {
    checkpointer: new MemorySaver(),
    emit: async () => {},
    saveLesson: async (p) => {
      saved = { spec: p.spec, htmlBody: p.htmlBody }
      return 'lesson-test-id'
    },
    updateRun: async () => {},
  }
  return { graph: buildGenerationGraph(deps), getSaved: () => saved }
}

/** Прогоняет граф до конца, автоматически проходя HITL-паузы (план — принять, ответы — авто). */
async function driveToEnd(
  graph: ReturnType<typeof buildGenerationGraph>,
  initial: GenerationState,
  threadId: string,
): Promise<GenerationState> {
  const config = { configurable: { thread_id: threadId }, recursionLimit: 100 }
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
    'extract-first: grammar-PDF → валидная спецификация и HTML',
    async () => {
      const material = await extractPdfText(readPdf('1_page.pdf'))
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
      expect(state.lessonId).toBe('lesson-test-id')
      const saved = getSaved()
      expect(saved).not.toBeNull()
      expect(lessonSpecSchema.safeParse(saved!.spec).success).toBe(true)
      expect(saved!.spec.parts.length).toBeGreaterThan(0)
      expect(saved!.htmlBody).toContain('<!DOCTYPE html>')
      expect(saved!.htmlBody).toContain('lesson-spec')
    },
    240_000,
  )

  it(
    'raw-материал: "раскройте скобки" → проходит HITL и завершается уроком',
    async () => {
      const material = readFileSync(path.join(DATA_DIR, 'raw.txt'), 'utf8')
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
      expect(state.lessonId).toBe('lesson-test-id')
      const saved = getSaved()
      expect(saved).not.toBeNull()
      expect(lessonSpecSchema.safeParse(saved!.spec).success).toBe(true)
      expect(saved!.spec.parts.length).toBeGreaterThan(0)
    },
    240_000,
  )
})
