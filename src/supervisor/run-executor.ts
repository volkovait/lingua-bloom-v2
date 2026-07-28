import { Command } from '@langchain/langgraph'

import { createServiceRoleClient } from '@/src/db/supabase'
import { saveLesson } from '@/src/db/lessons'
import { appendEvent, updateRun } from '@/src/db/runs'

import { buildGenerationGraph } from './graph'
import { getCheckpointer } from './checkpointer'
import { GenerationStateAnnotation, type GenerationState } from './state'

function buildInitialState(input: {
  userId: string
  runId: string
  threadId: string
  initial: Partial<GenerationState>
}): GenerationState {
  const defaults = {
    userId: input.userId,
    runId: input.runId,
    threadId: input.threadId,
    title: 'Тест',
    material: '',
    sourceType: 'text' as const,
    mode: 'ready_material' as const,
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
  } satisfies GenerationState
  return { ...defaults, ...input.initial }
}

/**
 * Запускает или продолжает граф генерации. Использует service-role клиент
 * (фоновые записи прогонов/событий/уроков в обход RLS).
 */
export async function runGeneration(input: {
  userId: string
  runId: string
  threadId: string
  initialState?: Partial<GenerationState>
  command?: Command
}): Promise<{ interrupted: boolean; interruptPayload: unknown }> {
  const client = createServiceRoleClient()
  const checkpointer = await getCheckpointer()

  const graph = buildGenerationGraph({
    checkpointer,
    emit: (payload) =>
      appendEvent(client, {
        runId: payload.runId,
        emoji: payload.emoji,
        title: payload.title,
        detail: payload.detail,
        nodeId: payload.nodeId,
      }),
    saveLesson: (payload) =>
      saveLesson(client, {
        userId: payload.userId,
        title: payload.title,
        sourceType: payload.sourceType,
        htmlBody: payload.htmlBody,
        spec: payload.spec,
        meta: payload.meta,
        generationRunId: payload.generationRunId,
      }),
    updateRun: (payload) =>
      updateRun(client, {
        runId: payload.runId,
        status: payload.status,
        phase: payload.phase,
        mode: payload.mode,
        lessonId: payload.lessonId,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        payloadPatch: payload.payloadPatch,
      }),
  })

  const config = { configurable: { thread_id: input.threadId }, recursionLimit: 80 }

  const result = input.command
    ? await graph.invoke(input.command as never, config)
    : await graph.invoke(
        buildInitialState({
          userId: input.userId,
          runId: input.runId,
          threadId: input.threadId,
          initial: input.initialState ?? {},
        }),
        config,
      )

  const raw = result as GenerationState & { __interrupt__?: Array<{ value: unknown }> }
  const interrupted = Array.isArray(raw.__interrupt__) && raw.__interrupt__.length > 0
  const interruptPayload = interrupted ? raw.__interrupt__![0]!.value : undefined

  if (interrupted) {
    await updateRun(client, {
      runId: input.runId,
      status: 'interrupted',
      phase: 'awaiting_resume',
      payloadPatch: { interrupt: interruptPayload },
    })
  }

  return { interrupted, interruptPayload }
}

/** Фоновый запуск: ловит ошибки и помечает прогон failed (не роняет процесс). */
export async function runGenerationInBackground(input: {
  userId: string
  runId: string
  threadId: string
  initialState?: Partial<GenerationState>
  command?: Command
}): Promise<void> {
  try {
    await runGeneration(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Непредвиденная ошибка генерации'
    try {
      await updateRun(createServiceRoleClient(), {
        runId: input.runId,
        status: 'failed',
        phase: 'failed',
        errorCode: 'RUN_CRASHED',
        errorMessage: message,
      })
    } catch {
      // Логи БД недоступны — уже ничего не сделать.
    }
  }
}

export { Command }
