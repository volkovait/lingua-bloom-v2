import type { BaseCheckpointSaver } from '@langchain/langgraph'

import type { LessonSpec } from '@/src/lesson-spec/schema'

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
