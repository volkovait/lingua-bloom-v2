import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'

import { env, type LlmRole } from '@/src/config/env'

export type CreateModelOptions = {
  role?: LlmRole
  temperature?: number
  maxTokens?: number
  /** Явное имя модели важнее роли/дефолта. */
  model?: string
}

/**
 * Единый OpenAI-совместимый chat-клиент (OpenAI / Polza.ai / OpenRouter и т.п.).
 * Провайдер задаётся через OPENAI_BASE_URL; модель — через роль или OPENAI_MODEL.
 */
export function createModel(options: CreateModelOptions = {}): BaseChatModel {
  const role = options.role ?? 'default'
  return new ChatOpenAI({
    model: options.model?.trim() || env.llm.model(role),
    temperature: options.temperature ?? 0.2,
    maxTokens: options.maxTokens ?? 4096,
    apiKey: env.llm.apiKey(),
    configuration: { baseURL: env.llm.baseUrl() },
  })
}
