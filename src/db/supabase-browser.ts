'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Next.js инлайнит в клиентский бандл только статические обращения
 * `process.env.NEXT_PUBLIC_*` — динамический `process.env[name]` в браузере пустой.
 */
function firstNonEmpty(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function getSupabaseUrl(): string {
  const url = firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url) {
    throw new Error('Не задана обязательная переменная окружения NEXT_PUBLIC_SUPABASE_URL.')
  }
  return url
}

function getSupabaseAnonKey(): string {
  const key = firstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
  if (!key) {
    throw new Error(
      'Не задана обязательная переменная окружения NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  return key
}

/** Клиент для клиентских компонентов (browser). Без server-only импортов. */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
}
