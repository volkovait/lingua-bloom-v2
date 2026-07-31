/**
 * Единая типизированная точка доступа к переменным окружения.
 * Бросает понятную ошибку при обращении к обязательной переменной, которой нет.
 */

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Не задана обязательная переменная окружения ${name}. Смотрите .env.example.`)
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback
}

/** Первое непустое значение среди переменных окружения. */
function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

function bool(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** Роль модели → env-оверрайд имени модели (иначе базовая модель). */
export type LlmRole = 'default' | 'classify' | 'plan' | 'spec'

// Оверрайды модели по ролям. Первым — OPENAI_*, затем совместимые POLZA_*
// (Polza.ai — OpenAI-совместимый провайдер, чтобы существующий .env работал как есть).
const ROLE_ENV: Record<LlmRole, string[]> = {
  default: [],
  classify: ['OPENAI_MODEL_CLASSIFY'],
  plan: ['OPENAI_MODEL_PLAN', 'POLZA_MODEL_PLANNER'],
  spec: ['OPENAI_MODEL_SPEC', 'POLZA_MODEL_SPEC'],
}

export const env = {
  llm: {
    apiKey: () => {
      const key = firstEnv('OPENAI_API_KEY', 'POLZA_AI_API_KEY', 'POLZA_API_KEY')
      if (!key) throw new Error('Не задан ключ LLM (OPENAI_API_KEY или POLZA_AI_API_KEY). Смотрите .env.example.')
      return key
    },
    baseUrl: () => firstEnv('OPENAI_BASE_URL', 'POLZA_BASE_URL') || 'https://api.openai.com/v1',
    model: (role: LlmRole = 'default') => {
      const override = firstEnv(...ROLE_ENV[role])
      const base = firstEnv('OPENAI_MODEL', 'POLZA_MODEL')
      if (!base) throw new Error('Не задана модель LLM (OPENAI_MODEL или POLZA_MODEL). Смотрите .env.example.')
      return override || base
    },
  },
  supabase: {
    url: () => required('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: () => optional('SUPABASE_SERVICE_ROLE_KEY'),
    dbUrl: () =>
      optional('SUPABASE_DB_URL') || optional('DATABASE_URL') || optional('POSTGRES_URL'),
  },
  auth: {
    disabled: () => bool('AUTH_DISABLED') || bool('NEXT_PUBLIC_AUTH_DISABLED'),
    impersonateUserId: () =>
      optional('AUTH_DISABLED_IMPERSONATE_USER_ID', '00000000-0000-0000-0000-000000000001'),
  },
  app: {
    /** Публичный origin: OAuth redirect и post-auth redirects. */
    url: () =>
      optional(
        'NEXT_PUBLIC_APP_URL',
        process.env.NODE_ENV === 'production'
          ? 'https://lingua-bloom.ru'
          : 'http://localhost:3000',
      ),
  },
  telegram: {
    /** Глобальный fallback, если у учителя нет настроек в профиле. */
    enabled: () => Boolean(firstEnv('TELEGRAM_BOT_TOKEN') && firstEnv('TELEGRAM_CHAT_ID')),
    botToken: () => required('TELEGRAM_BOT_TOKEN'),
    chatId: () => required('TELEGRAM_CHAT_ID'),
  },
} as const
