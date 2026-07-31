import { env } from '@/src/config/env'
import { getTelegramSettings } from '@/src/db/telegram-settings'
import { createServiceRoleClient } from '@/src/db/supabase'

export type TelegramDeliveryConfig = {
  botToken: string
  chatId: string
}

/** Настройки учителя; при отсутствии — глобальный fallback из env (локальная разработка). */
export async function resolveTelegramDelivery(
  userId: string,
): Promise<TelegramDeliveryConfig | null> {
  const client = createServiceRoleClient()
  const settings = await getTelegramSettings(client, userId)

  if (
    settings?.enabled &&
    settings.telegram_chat_id.trim() &&
    settings.telegram_bot_token.trim()
  ) {
    return {
      botToken: settings.telegram_bot_token.trim(),
      chatId: settings.telegram_chat_id.trim(),
    }
  }

  if (env.telegram.enabled()) {
    return {
      botToken: env.telegram.botToken(),
      chatId: env.telegram.chatId(),
    }
  }

  return null
}
