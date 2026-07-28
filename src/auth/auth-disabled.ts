import { env } from '@/src/config/env'

/** Включён ли режим без авторизации (локальная разработка). */
export function isAuthDisabled(): boolean {
  return env.auth.disabled()
}

/** UUID пользователя, под которым пишем в БД при выключенной авторизации. */
export function impersonatedUserId(): string {
  return env.auth.impersonateUserId()
}
