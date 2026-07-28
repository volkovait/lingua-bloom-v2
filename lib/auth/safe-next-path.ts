/** Limits open redirects after OAuth — only same-origin relative paths. */
export function safeInternalPath(
  path: string | null | undefined,
  fallback: string,
): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return fallback
  }
  if (path.includes('://')) {
    return fallback
  }
  return path
}
