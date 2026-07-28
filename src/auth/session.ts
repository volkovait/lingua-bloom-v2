import { createServerSupabaseClient } from '@/src/db/supabase'

import { impersonatedUserId, isAuthDisabled } from './auth-disabled'

/**
 * Возвращает id текущего пользователя для серверных обработчиков.
 * При AUTH_DISABLED — фиксированный impersonate id; иначе — из сессии Supabase (или null).
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (isAuthDisabled()) return impersonatedUserId()
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
