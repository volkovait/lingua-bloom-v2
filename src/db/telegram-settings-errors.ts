export function formatTelegramSettingsError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Неизвестная ошибка'

  if (
    message.includes('user_telegram_settings') &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('Could not find the table'))
  ) {
    return 'Таблица настроек Telegram ещё не создана в базе. Выполните миграцию user_telegram_settings в Supabase.'
  }

  if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return 'На сервере не задан SUPABASE_SERVICE_ROLE_KEY — сохранение настроек невозможно.'
  }

  if (message.includes('user_telegram_settings_user_id_fkey') || message.includes('violates foreign key constraint')) {
    return 'Профиль пользователя не найден в Supabase Auth. Войдите через аккаунт или проверьте AUTH_DISABLED_IMPERSONATE_USER_ID.'
  }

  return message
}
