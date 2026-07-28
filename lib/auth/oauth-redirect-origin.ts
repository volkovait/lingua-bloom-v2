/**
 * Base URL for OAuth `redirectTo` (must be listed in Supabase → Authentication →
 * URL Configuration → Redirect URLs).
 *
 * Prefer `NEXT_PUBLIC_APP_URL` (inlined at build time for the browser bundle).
 * Fallbacks: current window origin in the browser, then env defaults
 * (prod → https://lingua-bloom.ru, local → http://localhost:3000).
 */
export function getOAuthRedirectOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin
    } catch {
      // Invalid URL in env — fall back below.
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://lingua-bloom.ru'
    : 'http://localhost:3000'
}
