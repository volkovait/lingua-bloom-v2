import type { GenerationState } from './state'

/** Имена worker-агентов (должны совпадать с compile({ name })). */
export const WORKER_AGENT_NAMES = {
  ingest: 'ingest_agent',
  classify: 'classify_agent',
  relevanceRaw: 'relevance_raw_agent',
  planDraft: 'plan_draft_agent',
  planHitl: 'plan_hitl_agent',
  relevanceReady: 'relevance_ready_agent',
  split: 'split_agent',
  answers: 'answers_agent',
  assembleSpec: 'assemble_spec_agent',
  autoSolve: 'auto_solve_agent',
  htmlBuild: 'html_build_agent',
  publish: 'publish_agent',
  failEnd: 'fail_end_agent',
} as const

export type WorkerAgentName = (typeof WORKER_AGENT_NAMES)[keyof typeof WORKER_AGENT_NAMES]

const TERMINAL_PHASES = new Set(['completed', 'failed', 'publish_failed'])

function normalizeAgentName(agentName: string): string {
  return agentName.trim().replace(/\s+/g, '_').toLowerCase()
}

export function handoffToolName(agentName: WorkerAgentName): string {
  return `transfer_to_${normalizeAgentName(agentName)}`
}

/**
 * Детерминированный роутинг: следующий worker по phase/errorCode/mode.
 * null — пайплайн завершён, supervisor не делает handoff.
 */
export function resolveNextHandoff(state: GenerationState): WorkerAgentName | null {
  if (TERMINAL_PHASES.has(state.phase)) return null

  switch (state.phase) {
    case 'init':
      return WORKER_AGENT_NAMES.ingest
    case 'ingest':
      return WORKER_AGENT_NAMES.classify
    case 'classify_failed':
      return WORKER_AGENT_NAMES.failEnd
    case 'classified':
      if (state.errorCode === 'CLASSIFY_FAILED') return WORKER_AGENT_NAMES.failEnd
      return state.mode === 'raw_material'
        ? WORKER_AGENT_NAMES.relevanceRaw
        : WORKER_AGENT_NAMES.relevanceReady
    case 'relevance_raw':
      return state.materialRelevant ? WORKER_AGENT_NAMES.planDraft : WORKER_AGENT_NAMES.failEnd
    case 'plan_draft_failed':
      return WORKER_AGENT_NAMES.failEnd
    case 'plan_draft':
      if (state.errorCode === 'PLAN_DRAFT_FAILED') return WORKER_AGENT_NAMES.failEnd
      return WORKER_AGENT_NAMES.planHitl
    case 'plan_approved':
      return WORKER_AGENT_NAMES.relevanceReady
    case 'relevance_ready':
      return state.materialRelevant ? WORKER_AGENT_NAMES.split : WORKER_AGENT_NAMES.failEnd
    case 'split':
      return WORKER_AGENT_NAMES.answers
    case 'answers_prefilled':
    case 'answers_skipped':
    case 'answers_collected':
      return WORKER_AGENT_NAMES.assembleSpec
    case 'spec_failed':
      return WORKER_AGENT_NAMES.failEnd
    case 'spec_built':
      if (state.errorCode === 'BUILD_SPEC_FAILED') return WORKER_AGENT_NAMES.failEnd
      return state.autoSolveRequested ? WORKER_AGENT_NAMES.autoSolve : WORKER_AGENT_NAMES.htmlBuild
    case 'auto_solved':
    case 'auto_solve_skipped':
      return WORKER_AGENT_NAMES.htmlBuild
    case 'html_failed':
      return WORKER_AGENT_NAMES.failEnd
    case 'html_build':
      return state.errorCode.trim() ? WORKER_AGENT_NAMES.failEnd : WORKER_AGENT_NAMES.publish
    default:
      return null
  }
}

export const SUPERVISOR_PROMPT = `Ты supervisor пайплайна генерации интерактивного теста.
Делегируй работу специализированным агентам через handoff-инструменты transfer_to_*.
Не выполняй шаги пайплайна сам — только координируй агентов.
Когда пайплайн завершён (phase completed или failed), ответь кратко без вызова инструментов.`
