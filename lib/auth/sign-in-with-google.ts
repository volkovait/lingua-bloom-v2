import type { SupabaseClient } from '@supabase/supabase-js'

import { getOAuthRedirectOrigin } from '@/lib/auth/oauth-redirect-origin'
import { safeInternalPath } from '@/lib/auth/safe-next-path'

/**
 * Google OAuth via Supabase (authorization code flow).
 */
export async function signInWithGoogle(
  supabase: SupabaseClient,
  nextPath: string,
): Promise<{ error: Error | null }> {
  const next = safeInternalPath(nextPath, '/')
  const origin = getOAuthRedirectOrigin()
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    return { error: new Error(error.message) }
  }
  if (data.url) {
    window.location.assign(data.url)
    return { error: null }
  }
  return { error: new Error('No OAuth URL returned') }
}
