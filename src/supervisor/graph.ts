import { END, START, StateGraph, interrupt } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph'

import { classifyMaterial } from '@/src/agents/classify-material'
import { checkRelevance } from '@/src/agents/check-relevance'
import { draftLessonPlan } from '@/src/agents/draft-lesson-plan'
import { generatePartExercises } from '@/src/agents/generate-spec'
import { solveAnswers } from '@/src/agents/solve-answers'
import { splitMaterialIntoParts } from '@/src/agents/split-parts'
import { validateExtractedPart } from '@/src/agents/validate-extracted'
import { extractCandidates } from '@/src/extract/candidates'
import { buildLessonHtmlFromSpec } from '@/src/html/build-lesson-html'
import { sanitizeLessonHtmlForDelivery } from '@/src/html/sanitize'
import { finalizeLessonSpec } from '@/src/lesson-spec/finalize'
import { lessonSpecSchema, type LessonExercise, type LessonSpec } from '@/src/lesson-spec/schema'

import { GenerationStateAnnotation, type GenerationState } from './state'

export type GraphDeps = {
  checkpointer: BaseCheckpointSaver
  emit: (input: {
    runId: string
    emoji: string
    title: string
    detail?: string
    nodeId?: string
  }) => Promise<void>
  saveLesson: (input: {
    userId: string
    title: string
    sourceType: 'pdf' | 'text'
    htmlBody: string
    spec: LessonSpec
    meta: Record<string, unknown>
    generationRunId: string
  }) => Promise<string>
  updateRun: (input: {
    runId: string
    status: 'running' | 'interrupted' | 'failed' | 'completed'
    phase: string
    mode?: 'ready_material' | 'raw_material'
    lessonId?: string | null
    errorCode?: string | null
    errorMessage?: string | null
    payloadPatch?: Record<string, unknown>
  }) => Promise<void>
}

function errMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export function buildGenerationGraph(deps: GraphDeps) {
  const graph = new StateGraph(GenerationStateAnnotation)

  type Wiring = {
    addEdge(from: string, to: string): void
    addConditionalEdges(
      from: string,
      path: (state: GenerationState) => string,
      mapping: Record<string, string>,
    ): void
  }
  const wire = graph as unknown as Wiring

  const log = (runId: string, nodeId: string, emoji: string, title: string, detail?: string) =>
    deps.emit({ runId, nodeId, emoji, title, ...(detail ? { detail } : {}) })

  // ── ingest ──────────────────────────────────────────────────────────
  graph.addNode('ingest', async (state: GenerationState) => {
    const material = state.material.trim()
    await log(state.runId, 'ingest', '📥', 'Загрузка и сбор текста', `Размер материала: ${material.length} симв.`)
    return { material, title: state.title.trim() || 'Тест', phase: 'ingest' }
  })

  // ── classify ────────────────────────────────────────────────────────
  graph.addNode('classify', async (state: GenerationState) => {
    await log(state.runId, 'classify', '🧭', 'Классификация материала')
    try {
      const mode = await classifyMaterial({ title: state.title, material: state.material })
      await deps.updateRun({ runId: state.runId, status: 'running', phase: 'classified', mode })
      await log(
        state.runId,
        'classify',
        '✅',
        'Тип материала определён',
        mode === 'raw_material' ? 'Сначала план урока' : 'Готовый материал — сразу к тесту',
      )
      return { mode, phase: 'classified', errorCode: '', errorMessage: '' }
    } catch (error) {
      const message = errMessage(error, 'Не удалось классифицировать материал.')
      await log(state.runId, 'classify', '⚠️', 'Ошибка классификации', message.slice(0, 500))
      return { errorCode: 'CLASSIFY_FAILED', errorMessage: message, phase: 'classify_failed' }
    }
  })

  // ── relevance (raw) ──────────────────────────────────────────────────
  graph.addNode('relevance_raw', async (state: GenerationState) => {
    await log(state.runId, 'relevance_raw', '🔎', 'Проверка: подходит ли сырой материал')
    const result = await checkRelevance({
      scope: 'raw_for_lesson_planning',
      title: state.title,
      material: state.material,
    })
    await log(
      state.runId,
      'relevance_raw',
      result.relevant ? '✅' : '⛔',
      result.relevant ? 'Материал подходит' : 'Материал не подходит',
      result.userMessage.slice(0, 400),
    )
    return { materialRelevant: result.relevant, relevanceMessage: result.userMessage, phase: 'relevance_raw' }
  })

  // ── plan draft ───────────────────────────────────────────────────────
  graph.addNode('plan_draft', async (state: GenerationState) => {
    await log(state.runId, 'plan_draft', '📝', 'Черновик плана урока')
    try {
      const planDraft = await draftLessonPlan({ title: state.title, material: state.material })
      await log(state.runId, 'plan_draft', '✅', 'Черновик плана готов', `${planDraft.length} симв.`)
      return { planDraft, phase: 'plan_draft', errorCode: '', errorMessage: '' }
    } catch (error) {
      const message = errMessage(error, 'Не удалось получить черновик плана.')
      await log(state.runId, 'plan_draft', '⚠️', 'Черновик не получен', message.slice(0, 500))
      return { errorCode: 'PLAN_DRAFT_FAILED', errorMessage: message, phase: 'plan_draft_failed' }
    }
  })

  // ── plan HITL (пауза: согласование плана) ────────────────────────────
  graph.addNode('plan_hitl', async (state: GenerationState) => {
    await log(state.runId, 'plan_hitl', '✋', 'Пауза: согласование плана с пользователем')
    const resume = interrupt({ type: 'plan_approval' as const, planMarkdown: state.planDraft })
    const edited =
      typeof resume === 'object' && resume !== null && 'editedPlanMarkdown' in resume
        ? String((resume as { editedPlanMarkdown?: string }).editedPlanMarkdown ?? '').trim()
        : ''
    const approvedPlan = edited.length > 0 ? edited : state.planDraft
    const merged = ['## Утверждённый план', approvedPlan, '', '## Исходные материалы', state.material]
      .filter((chunk) => chunk.trim().length > 0)
      .join('\n\n')
    await log(
      state.runId,
      'plan_hitl',
      '✅',
      'План принят',
      edited.length > 0 ? 'С правками пользователя' : 'Черновик без изменений',
    )
    return { material: merged.slice(0, 120_000), phase: 'plan_approved' }
  })

  // ── relevance (ready) ────────────────────────────────────────────────
  graph.addNode('relevance_ready', async (state: GenerationState) => {
    await log(state.runId, 'relevance_ready', '🎯', 'Проверка: подходит ли для теста')
    const result = await checkRelevance({
      scope: 'ready_for_interactive_tests',
      title: state.title,
      material: state.material,
    })
    await log(
      state.runId,
      'relevance_ready',
      result.relevant ? '✅' : '⛔',
      result.relevant ? 'Материал подходит для теста' : 'Материал не подходит',
      result.userMessage.slice(0, 400),
    )
    return { materialRelevant: result.relevant, relevanceMessage: result.userMessage, phase: 'relevance_ready' }
  })

  // ── split ────────────────────────────────────────────────────────────
  graph.addNode('split', async (state: GenerationState) => {
    await log(state.runId, 'split', '✂️', 'Разбиение на части')
    const parts = await splitMaterialIntoParts({ title: state.title, material: state.material })
    await log(state.runId, 'split', '✅', 'Материал разбит', `Частей: ${parts.length}`)
    return { parts, phase: 'split' }
  })

  // ── answers HITL (пауза: ответы пользователя или автоответы) ─────────
  graph.addNode('answers', async (state: GenerationState) => {
    if (state.correctAnswersHint.trim().length > 0 || state.autoSolveRequested) {
      await log(state.runId, 'answers', '⏭️', 'Пауза пропущена', 'Ответы уже заданы или выбраны автоответы')
      return { phase: 'answers_prefilled' }
    }
    const { candidates } = extractCandidates(state.material)
    const hasUnanswered = candidates.some((c) => c.answer === null)
    if (candidates.length === 0 || !hasUnanswered) {
      await log(state.runId, 'answers', '⏭️', 'Пауза пропущена', 'В материале нет вопросов без ответов')
      return { phase: 'answers_skipped' }
    }
    await log(state.runId, 'answers', '✋', 'Пауза: ответы пользователя или автоответы')
    const resume = interrupt({
      type: 'answers' as const,
      message: 'Пришлите правильные ответы текстом или выберите «Автоответы модели» (точность не гарантируется).',
    })
    let autoSolveRequested = false
    let hint = ''
    if (typeof resume === 'object' && resume !== null && 'autoSolve' in resume) {
      autoSolveRequested = Boolean((resume as { autoSolve?: boolean }).autoSolve)
    } else if (typeof resume === 'string') {
      hint = resume.trim()
    } else if (typeof resume === 'object' && resume !== null && 'answersText' in resume) {
      hint = String((resume as { answersText?: string }).answersText ?? '').trim()
    }
    await log(
      state.runId,
      'answers',
      '✅',
      'Ответ пользователя получен',
      autoSolveRequested ? 'Выбраны автоответы' : hint ? `Ответы получены (${hint.length} симв.)` : 'Пусто',
    )
    return { correctAnswersHint: hint, autoSolveRequested, phase: 'answers_collected' }
  })

  // ── assemble spec (extract-first) ────────────────────────────────────
  graph.addNode('assemble_spec', async (state: GenerationState) => {
    await log(state.runId, 'assemble_spec', '🧩', 'Сборка спецификации теста')
    try {
      const parts = state.parts.length > 0 ? state.parts : [{ title: state.title, text: state.material }]
      const assembled: Array<{ title: string; exercises: LessonExercise[] }> = []
      const hint = state.correctAnswersHint.trim() || undefined

      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i]
        const partTitle = part.title.trim() || `Часть ${i + 1}`
        const { candidates, hasReadyExercises } = extractCandidates(part.text)

        // Сбой одной части не должен рушить весь прогон — логируем и пропускаем.
        try {
          let result
          if (hasReadyExercises) {
            result = await validateExtractedPart({
              lessonTitle: state.title,
              partTitle,
              partText: part.text,
              candidates,
              answersHint: hint,
            })
            await log(
              state.runId,
              'assemble_spec',
              '📎',
              `Часть «${partTitle}»: извлечено из источника`,
              `Кандидатов: ${candidates.length}, упражнений: ${result.exercises.length}`,
            )
          } else {
            result = await generatePartExercises({
              lessonTitle: state.title,
              partTitle,
              partText: part.text,
              answersHint: hint,
            })
            await log(
              state.runId,
              'assemble_spec',
              '✨',
              `Часть «${partTitle}»: сгенерировано`,
              `Готовых заданий не найдено — упражнений: ${result.exercises.length}`,
            )
          }
          assembled.push({ title: partTitle, exercises: result.exercises })
        } catch (partError) {
          await log(
            state.runId,
            'assemble_spec',
            '⚠️',
            `Часть «${partTitle}» пропущена`,
            errMessage(partError, 'Не удалось собрать задания для части').slice(0, 300),
          )
        }
      }

      // finalize может отбраковать все вопросы (бросает) — тогда возвращаем null для фолбэка.
      const finalizeOrNull = (partsToFinalize: Array<{ title: string; exercises: LessonExercise[] }>) => {
        try {
          return finalizeLessonSpec({ title: state.title, parts: partsToFinalize })
        } catch {
          return null
        }
      }

      let finalized = assembled.length > 0 ? finalizeOrNull(assembled) : null

      // Фолбэк: части не собрались или всё отбраковано → одна генерация по всему материалу.
      if (!finalized) {
        await log(state.runId, 'assemble_spec', '🔁', 'Пересборка по всему материалу')
        const whole = await generatePartExercises({
          lessonTitle: state.title,
          partTitle: state.title || 'Тест',
          partText: state.material,
          answersHint: hint,
        })
        finalized = finalizeOrNull([{ title: state.title || 'Тест', exercises: whole.exercises }])
      }

      if (!finalized) throw new Error('Не удалось собрать валидную спецификацию теста.')
      const { spec, warnings } = finalized
      await log(
        state.runId,
        'assemble_spec',
        '✅',
        'Спецификация готова',
        `Частей: ${spec.parts.length}, предупреждений: ${warnings.length}`,
      )
      return {
        specJson: JSON.stringify(spec),
        validationWarnings: warnings,
        phase: 'spec_built',
        errorCode: '',
        errorMessage: '',
      }
    } catch (error) {
      const message = errMessage(error, 'Не удалось собрать спецификацию теста.')
      await log(state.runId, 'assemble_spec', '⚠️', 'Ошибка сборки спецификации', message.slice(0, 800))
      return { errorCode: 'BUILD_SPEC_FAILED', errorMessage: message, phase: 'spec_failed' }
    }
  })

  // ── auto solve ───────────────────────────────────────────────────────
  graph.addNode('auto_solve', async (state: GenerationState) => {
    await log(state.runId, 'auto_solve', '🤖', 'Модель заполняет ответы')
    if (!state.specJson) return { autoSolveRequested: false, phase: 'auto_solve_skipped' }
    const spec = lessonSpecSchema.parse(JSON.parse(state.specJson) as unknown)
    const { spec: solved, disclaimer } = await solveAnswers({ spec, material: state.material })
    // Пересобираем и валидируем после заполнения ответов.
    const { spec: finalSpec } = finalizeLessonSpec({ title: solved.title, parts: solved.parts })
    await log(state.runId, 'auto_solve', '✅', 'Ответы заполнены')
    return {
      specJson: JSON.stringify(finalSpec),
      autoSolveRequested: false,
      autoSolveDisclaimer: disclaimer,
      phase: 'auto_solved',
    }
  })

  // ── html build ───────────────────────────────────────────────────────
  graph.addNode('html_build', async (state: GenerationState) => {
    await log(state.runId, 'html_build', '🌐', 'Сборка HTML')
    if (!state.specJson) {
      return { errorCode: 'NO_SPEC', errorMessage: 'Нет спецификации', phase: 'html_failed' }
    }
    const spec = lessonSpecSchema.parse(JSON.parse(state.specJson) as unknown)
    const html = sanitizeLessonHtmlForDelivery(buildLessonHtmlFromSpec(spec))
    await log(state.runId, 'html_build', '✅', 'HTML собран', `${html.length} симв.`)
    return { htmlBody: html, phase: 'html_build', errorCode: '', errorMessage: '' }
  })

  // ── publish ──────────────────────────────────────────────────────────
  graph.addNode('publish', async (state: GenerationState) => {
    await log(state.runId, 'publish', '🚀', 'Сохранение урока')
    if (!state.specJson || !state.htmlBody) {
      await deps.updateRun({
        runId: state.runId,
        status: 'failed',
        phase: 'publish_failed',
        errorCode: 'PUBLISH_INCOMPLETE',
        errorMessage: 'Нет HTML или спецификации',
      })
      return { phase: 'publish_failed' }
    }
    const spec = lessonSpecSchema.parse(JSON.parse(state.specJson) as unknown)
    const lessonId = await deps.saveLesson({
      userId: state.userId,
      title: state.title,
      sourceType: state.sourceType,
      htmlBody: state.htmlBody,
      spec,
      meta: {
        generatedAt: new Date().toISOString(),
        engine: 'supervisor-extract-first-v2',
        generationRunId: state.runId,
        ...(state.autoSolveDisclaimer ? { autoSolveDisclaimer: state.autoSolveDisclaimer } : {}),
        ...(state.validationWarnings.length > 0 ? { validationWarnings: state.validationWarnings } : {}),
      },
      generationRunId: state.runId,
    })
    await deps.updateRun({ runId: state.runId, status: 'completed', phase: 'completed', lessonId })
    await log(state.runId, 'publish', '✅', 'Урок сохранён', `lessonId: ${lessonId}`)
    return { lessonId, phase: 'completed' }
  })

  // ── fail ─────────────────────────────────────────────────────────────
  graph.addNode('fail_end', async (state: GenerationState) => {
    const detail = state.errorMessage.trim() || state.relevanceMessage.trim()
    await log(state.runId, 'fail_end', '⛔', 'Генерация остановлена', detail || undefined)
    await deps.updateRun({
      runId: state.runId,
      status: 'failed',
      phase: 'failed',
      errorCode: state.errorCode.trim() || 'MATERIAL_NOT_RELEVANT',
      errorMessage: detail,
    })
    return { phase: 'failed' }
  })

  // ── routing ──────────────────────────────────────────────────────────
  wire.addEdge(START, 'ingest')
  wire.addEdge('ingest', 'classify')
  wire.addConditionalEdges(
    'classify',
    (s) =>
      s.errorCode === 'CLASSIFY_FAILED' ? 'fail_end' : s.mode === 'raw_material' ? 'relevance_raw' : 'relevance_ready',
    { relevance_raw: 'relevance_raw', relevance_ready: 'relevance_ready', fail_end: 'fail_end' },
  )
  wire.addConditionalEdges('relevance_raw', (s) => (s.materialRelevant ? 'plan_draft' : 'fail_end'), {
    plan_draft: 'plan_draft',
    fail_end: 'fail_end',
  })
  wire.addConditionalEdges('plan_draft', (s) => (s.errorCode === 'PLAN_DRAFT_FAILED' ? 'fail_end' : 'plan_hitl'), {
    plan_hitl: 'plan_hitl',
    fail_end: 'fail_end',
  })
  wire.addEdge('plan_hitl', 'relevance_ready')
  wire.addConditionalEdges('relevance_ready', (s) => (s.materialRelevant ? 'split' : 'fail_end'), {
    split: 'split',
    fail_end: 'fail_end',
  })
  wire.addEdge('split', 'answers')
  wire.addEdge('answers', 'assemble_spec')
  wire.addConditionalEdges(
    'assemble_spec',
    (s) =>
      s.errorCode === 'BUILD_SPEC_FAILED' ? 'fail_end' : s.autoSolveRequested ? 'auto_solve' : 'html_build',
    { auto_solve: 'auto_solve', html_build: 'html_build', fail_end: 'fail_end' },
  )
  wire.addEdge('auto_solve', 'html_build')
  wire.addConditionalEdges('html_build', (s) => (s.errorCode.trim() ? 'fail_end' : 'publish'), {
    publish: 'publish',
    fail_end: 'fail_end',
  })
  wire.addEdge('publish', END)
  wire.addEdge('fail_end', END)

  return graph.compile({ checkpointer: deps.checkpointer })
}
