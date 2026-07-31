import { randomUUID } from 'node:crypto'

import { AIMessage, SystemMessage } from '@langchain/core/messages'
import { createSupervisor } from '@langchain/langgraph-supervisor'

import { createModel } from '@/src/llm/model'

import { createNodeHandlers } from './nodes'
import { handoffToolName, resolveNextHandoff, SUPERVISOR_PROMPT } from './router'
import { GenerationStateAnnotation, type GenerationState } from './state'
import type { GraphDeps } from './types'
import { createWorkerAgents } from './workers'

export type { GraphDeps } from './types'

function createSupervisorHooks() {
  return {
    preModelHook: (state: GenerationState) => {
      const next = resolveNextHandoff(state)
      if (!next) {
        return {
          llmInputMessages: [
            new SystemMessage(
              `Пайплайн завершён (phase=${state.phase}). Ответь одной короткой фразой на русском. Не вызывай инструменты.`,
            ),
          ],
        }
      }
      return {
        llmInputMessages: [
          new SystemMessage(
            `Текущая phase=${state.phase}. Следующий шаг — handoff в агента ${next} через ${handoffToolName(next)}.`,
          ),
        ],
      }
    },
    postModelHook: (state: GenerationState) => {
      const next = resolveNextHandoff(state)
      if (!next) return {}
      return {
        messages: [
          new AIMessage({
            content: '',
            tool_calls: [{ name: handoffToolName(next), args: {}, id: randomUUID() }],
          }),
        ],
      }
    },
  }
}

export function buildGenerationGraph(deps: GraphDeps) {
  const handlers = createNodeHandlers(deps)
  const agents = createWorkerAgents(deps, handlers)
  const hooks = createSupervisorHooks()

  const workflow = createSupervisor({
    agents,
    llm: createModel({ role: 'default', temperature: 0, maxTokens: 256 }),
    prompt: SUPERVISOR_PROMPT,
    stateSchema: GenerationStateAnnotation,
    outputMode: 'last_message',
    addHandoffMessages: true,
    addHandoffBackMessages: true,
    supervisorName: 'pipeline_supervisor',
    preModelHook: hooks.preModelHook,
    postModelHook: hooks.postModelHook,
  })

  return workflow.compile({ checkpointer: deps.checkpointer })
}
