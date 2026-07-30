import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export type UpdateSessionResult = {
  response: NextResponse
  user: User | null
}

function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!value) {
    throw new Error('Не задана NEXT_PUBLIC_SUPABASE_URL (нужна для refresh сессии в middleware).')
  }
  return value
}

function supabaseAnonKey(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!value) {
    throw new Error('Не задана NEXT_PUBLIC_SUPABASE_ANON_KEY (нужна для refresh сессии в middleware).')
  }
  return value
}

/**
 * Обновляет Supabase-сессию в cookies (refresh access token).
 * Без этого middleware «есть sb-* cookie» не гарантирует валидный user в API/RSC —
 * getUser() на сервере часто возвращает null → «Не авторизован».
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        supabaseResponse = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  // Не вставлять код между createServerClient и getUser — ломает refresh сессии.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response: supabaseResponse, user }
}

/** Копирует Set-Cookie с ответа updateSession на redirect (иначе сессия «отваливается»). */
export function copyCookiesTo(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value)
  }
}
