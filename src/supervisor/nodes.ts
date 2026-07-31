import { interrupt } from '@langchain/langgraph'

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
import { checkSpecFidelity } from '@/src/lesson-spec/fidelity-check'
import { finalizeLessonSpec } from '@/src/lesson-spec/finalize'
import { mapCandidatesToPartExercises } from '@/src/lesson-spec/map-candidates-to-spec'
import { lessonSpecSchema, type LessonExercise } from '@/src/lesson-spec/schema'

import type { GraphDeps } from './types'
import type { GenerationState } from './state'

function errMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export function createNodeHandlers(deps: GraphDeps) {
  const log = (runId: string, nodeId: string, emoji: string, title: string, detail?: string) =>
    deps.emit({ runId, nodeId, emoji, title, ...(detail ? { detail } : {}) })

  return {
    ingest: async (state: GenerationState) => {
      const material = state.material.trim()
      await log(state.runId, 'ingest', '📥', 'Загрузка и сбор текста', `Размер материала: ${material.length} симв.`)
      return { material, title: state.title.trim() || 'Тест', phase: 'ingest' }
    },

    classify: async (state: GenerationState) => {
      await log(state.runId, 'classify', '🧭', 'Классификация материала')
      try {
        const { mode, materialIntent } = await classifyMaterial({ title: state.title, material: state.material })
        await deps.updateRun({ runId: state.runId, status: 'running', phase: 'classified', mode })
        await log(
          state.runId,
          'classify',
          '✅',
          'Тип материала определён',
          materialIntent === 'reproduce_test'
            ? 'Готовый тест — воспроизведение без дополнений'
            : mode === 'raw_material'
              ? 'Сначала план урока'
              : 'Готовый материал — генерация теста',
        )
        return { mode, materialIntent, phase: 'classified', errorCode: '', errorMessage: '' }
      } catch (error) {
        const message = errMessage(error, 'Не удалось классифицировать материал.')
        await log(state.runId, 'classify', '⚠️', 'Ошибка классификации', message.slice(0, 500))
        return { errorCode: 'CLASSIFY_FAILED', errorMessage: message, phase: 'classify_failed' }
      }
    },

    relevanceRaw: async (state: GenerationState) => {
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
    },

    planDraft: async (state: GenerationState) => {
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
    },

    planHitl: async (state: GenerationState) => {
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
    },

    relevanceReady: async (state: GenerationState) => {
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
    },

    split: async (state: GenerationState) => {
      await log(state.runId, 'split', '✂️', 'Разбиение на части')
      const parts = await splitMaterialIntoParts({ title: state.title, material: state.material })
      await log(state.runId, 'split', '✅', 'Материал разбит', `Частей: ${parts.length}`)
      return { parts, phase: 'split' }
    },

    answers: async (state: GenerationState) => {
      if (state.correctAnswersHint.trim().length > 0 || state.autoSolveRequested) {
        await log(state.runId, 'answers', '⏭️', 'Пауза пропущена', 'Ответы уже заданы или выбраны автоответы')
        return { phase: 'answers_prefilled' }
      }
      const { candidates } = extractCandidates(state.material)
      const hasUnanswered = candidates.some((candidate) => candidate.answer === null)
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
    },

    assembleSpec: async (state: GenerationState) => {
      await log(state.runId, 'assemble_spec', '🧩', 'Сборка спецификации теста')
      try {
        const parts = state.parts.length > 0 ? state.parts : [{ title: state.title, text: state.material }]
        const assembled: Array<{ title: string; exercises: LessonExercise[] }> = []
        const hint = state.correctAnswersHint.trim() || undefined

        const finalizeOrNull = (partsToFinalize: Array<{ title: string; exercises: LessonExercise[] }>) => {
          try {
            return finalizeLessonSpec({ title: state.title, parts: partsToFinalize })
          } catch {
            return null
          }
        }

        for (let index = 0; index < parts.length; index += 1) {
          const part = parts[index]
          const partTitle = part.title.trim() || `Часть ${index + 1}`
          const { candidates, hasReadyExercises } = extractCandidates(part.text)
          const useReproduce = state.materialIntent === 'reproduce_test' || hasReadyExercises

          try {
            if (useReproduce) {
              if (candidates.length === 0) {
                throw new Error(
                  'Материал помечен как готовый тест, но парсер не нашёл заданий для воспроизведения.',
                )
              }

              let exercises: LessonExercise[] | null = null

              try {
                const mapped = mapCandidatesToPartExercises({ candidates, partTitle })
                const trial = finalizeOrNull([{ title: partTitle, exercises: mapped.exercises }])
                if (trial) {
                  const fidelity = checkSpecFidelity(trial.spec, candidates)
                  if (fidelity.ok) {
                    exercises = mapped.exercises
                    await log(
                      state.runId,
                      'assemble_spec',
                      '📎',
                      `Часть «${partTitle}»: воспроизведено из источника`,
                      `Кандидатов: ${candidates.length}, упражнений: ${mapped.exercises.length}`,
                    )
                  }
                }
              } catch {
                // Пробуем LLM-нормализацию ниже.
              }

              if (!exercises) {
                const validated = await validateExtractedPart({
                  lessonTitle: state.title,
                  partTitle,
                  partText: part.text,
                  candidates,
                  answersHint: hint,
                })
                const trial = finalizeOrNull([{ title: partTitle, exercises: validated.exercises }])
                if (!trial) {
                  throw new Error('Не удалось финализовать воспроизведённую спецификацию.')
                }
                const fidelity = checkSpecFidelity(trial.spec, candidates)
                if (!fidelity.ok) {
                  throw new Error(
                    `BUILD_SPEC_FIDELITY_FAILED: ${fidelity.warnings.join('; ')}`,
                  )
                }
                exercises = validated.exercises
                await log(
                  state.runId,
                  'assemble_spec',
                  '📎',
                  `Часть «${partTitle}»: нормализовано LLM`,
                  `Кандидатов: ${candidates.length}, упражнений: ${validated.exercises.length}`,
                )
              }

              assembled.push({ title: partTitle, exercises })
            } else {
              const generated = await generatePartExercises({
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
                `Упражнений: ${generated.exercises.length}`,
              )
              assembled.push({ title: partTitle, exercises: generated.exercises })
            }
          } catch (partError) {
            if (useReproduce) {
              throw partError
            }
            await log(
              state.runId,
              'assemble_spec',
              '⚠️',
              `Часть «${partTitle}» пропущена`,
              errMessage(partError, 'Не удалось собрать задания для части').slice(0, 300),
            )
          }
        }

        let finalized = assembled.length > 0 ? finalizeOrNull(assembled) : null

        if (!finalized && state.materialIntent !== 'reproduce_test') {
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
        const errorCode = message.includes('BUILD_SPEC_FIDELITY_FAILED')
          ? 'BUILD_SPEC_FIDELITY_FAILED'
          : 'BUILD_SPEC_FAILED'
        await log(state.runId, 'assemble_spec', '⚠️', 'Ошибка сборки спецификации', message.slice(0, 800))
        return { errorCode, errorMessage: message, phase: 'spec_failed' }
      }
    },

    autoSolve: async (state: GenerationState) => {
      await log(state.runId, 'auto_solve', '🤖', 'Модель заполняет ответы')
      if (!state.specJson) return { autoSolveRequested: false, phase: 'auto_solve_skipped' }
      const spec = lessonSpecSchema.parse(JSON.parse(state.specJson) as unknown)
      const { spec: solved, disclaimer } = await solveAnswers({ spec, material: state.material })
      const { spec: finalSpec } = finalizeLessonSpec({ title: solved.title, parts: solved.parts })
      await log(state.runId, 'auto_solve', '✅', 'Ответы заполнены')
      return {
        specJson: JSON.stringify(finalSpec),
        autoSolveRequested: false,
        autoSolveDisclaimer: disclaimer,
        phase: 'auto_solved',
      }
    },

    htmlBuild: async (state: GenerationState) => {
      await log(state.runId, 'html_build', '🌐', 'Сборка HTML')
      if (!state.specJson) {
        return { errorCode: 'NO_SPEC', errorMessage: 'Нет спецификации', phase: 'html_failed' }
      }
      const spec = lessonSpecSchema.parse(JSON.parse(state.specJson) as unknown)
      const html = sanitizeLessonHtmlForDelivery(buildLessonHtmlFromSpec(spec))
      await log(state.runId, 'html_build', '✅', 'HTML собран', `${html.length} симв.`)
      return { htmlBody: html, phase: 'html_build', errorCode: '', errorMessage: '' }
    },

    publish: async (state: GenerationState) => {
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
          engine: 'langgraph-supervisor-extract-first-v2',
          generationRunId: state.runId,
          ...(state.autoSolveDisclaimer ? { autoSolveDisclaimer: state.autoSolveDisclaimer } : {}),
          ...(state.validationWarnings.length > 0 ? { validationWarnings: state.validationWarnings } : {}),
        },
        generationRunId: state.runId,
      })
      await deps.updateRun({ runId: state.runId, status: 'completed', phase: 'completed', lessonId })
      await log(state.runId, 'publish', '✅', 'Урок сохранён', `lessonId: ${lessonId}`)
      return { lessonId, phase: 'completed' }
    },

    failEnd: async (state: GenerationState) => {
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
    },
  }
}

export type NodeHandlers = ReturnType<typeof createNodeHandlers>
