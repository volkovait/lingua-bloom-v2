/**
 * Next.js instrumentation: выполняется один раз при старте сервера (nodejs runtime).
 *
 * @supabase/supabase-js создаёт Realtime-клиент в конструкторе и требует глобальный WebSocket,
 * который есть только в Node 22+. На Node 20 без полифилла падает `createClient` → 500 на /api/runs.
 * Realtime мы не используем, но конструктор всё равно требует WebSocket — берём его из undici.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const globalObject = globalThis as { WebSocket?: unknown }
  if (typeof globalObject.WebSocket !== 'undefined') return
  const { WebSocket } = await import('undici')
  globalObject.WebSocket = WebSocket
}
