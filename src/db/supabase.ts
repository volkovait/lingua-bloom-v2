import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import { env } from '@/src/config/env'

export { createBrowserSupabaseClient } from './supabase-browser'

/**
 * Клиент для server components / route handlers — читает и обновляет сессию через cookies.
 * В некоторых серверных контекстах запись cookies запрещена — тогда игнорируем ошибку.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  return createServerClient(env.supabase.url(), env.supabase.anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Вызвано из server component — запись cookies недоступна, безопасно игнорируем.
        }
      },
    },
  })
}

/**
 * Service-role клиент: серверные операции в обход RLS (используется при AUTH_DISABLED
 * и для фоновой записи прогонов/событий). НЕ использовать в браузере.
 */
export function createServiceRoleClient(): SupabaseClient {
  const key = env.supabase.serviceRoleKey()
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY не задан — серверные записи в обход RLS невозможны.')
  }
  return createClient(env.supabase.url(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
