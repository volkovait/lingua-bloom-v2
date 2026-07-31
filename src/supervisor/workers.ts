import { AIMessage } from '@langchain/core/messages'
import { END, START, StateGraph } from '@langchain/langgraph'

import { GenerationStateAnnotation, type GenerationState } from './state'
import { createNodeHandlers, type NodeHandlers } from './nodes'
import type { GraphDeps } from './types'
import { WORKER_AGENT_NAMES, type WorkerAgentName } from './router'

type WorkerDefinition = {
  name: WorkerAgentName
  description: string
  run: (state: GenerationState) => Promise<Partial<GenerationState>>
}

function createWorkerAgent(definition: WorkerDefinition) {
  const graph = new StateGraph(GenerationStateAnnotation)
    .addNode('run', async (state: GenerationState) => {
      const update = await definition.run(state)
      return {
        ...update,
        messages: [
          new AIMessage({
            content: `[${definition.name}] phase=${String(update.phase ?? state.phase)}`,
            name: definition.name,
          }),
        ],
      }
    })
    .addEdge(START, 'run')
    .addEdge('run', END)

  return graph.compile({ name: definition.name, description: definition.description })
}

export function createWorkerAgents(deps: GraphDeps, handlers: NodeHandlers) {
  const definitions: WorkerDefinition[] = [
    {
      name: WORKER_AGENT_NAMES.ingest,
      description: 'Нормализует загруженный материал и заголовок.',
      run: handlers.ingest,
    },
    {
      name: WORKER_AGENT_NAMES.classify,
      description: 'Классифицирует материал: raw vs ready.',
      run: handlers.classify,
    },
    {
      name: WORKER_AGENT_NAMES.relevanceRaw,
      description: 'Проверяет релевантность сырого материала для плана урока.',
      run: handlers.relevanceRaw,
    },
    {
      name: WORKER_AGENT_NAMES.planDraft,
      description: 'Генерирует черновик плана урока.',
      run: handlers.planDraft,
    },
    {
      name: WORKER_AGENT_NAMES.planHitl,
      description: 'Пауза HITL: согласование плана с пользователем.',
      run: handlers.planHitl,
    },
    {
      name: WORKER_AGENT_NAMES.relevanceReady,
      description: 'Проверяет релевантность материала для интерактивного теста.',
      run: handlers.relevanceReady,
    },
    {
      name: WORKER_AGENT_NAMES.split,
      description: 'Разбивает материал на логические части.',
      run: handlers.split,
    },
    {
      name: WORKER_AGENT_NAMES.answers,
      description: 'Пауза HITL: ответы пользователя или автоответы модели.',
      run: handlers.answers,
    },
    {
      name: WORKER_AGENT_NAMES.assembleSpec,
      description: 'Собирает JSON-спецификацию теста (extract-first).',
      run: handlers.assembleSpec,
    },
    {
      name: WORKER_AGENT_NAMES.autoSolve,
      description: 'Заполняет ответы моделью при запросе автоответов.',
      run: handlers.autoSolve,
    },
    {
      name: WORKER_AGENT_NAMES.htmlBuild,
      description: 'Собирает HTML урока из спецификации.',
      run: handlers.htmlBuild,
    },
    {
      name: WORKER_AGENT_NAMES.publish,
      description: 'Сохраняет готовый урок в базу.',
      run: handlers.publish,
    },
    {
      name: WORKER_AGENT_NAMES.failEnd,
      description: 'Завершает прогон с ошибкой.',
      run: handlers.failEnd,
    },
  ]

  return definitions.map(createWorkerAgent)
}
