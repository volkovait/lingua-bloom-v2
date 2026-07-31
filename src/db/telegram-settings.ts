import type { SupabaseClient } from '@supabase/supabase-js'

const TABLE = 'user_telegram_settings'

export type UserTelegramSettingsRow = {
  user_id: string
  telegram_chat_id: string
  telegram_bot_token: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export type TelegramSettingsView = {
  enabled: boolean
  chatId: string
  tokenConfigured: boolean
}

export async function getTelegramSettings(
  client: SupabaseClient,
  userId: string,
): Promise<UserTelegramSettingsRow | null> {
  const { data, error } = await client.from(TABLE).select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Не удалось прочитать настройки Telegram: ${error.message}`)
  return (data as UserTelegramSettingsRow | null) ?? null
}

export function toTelegramSettingsView(row: UserTelegramSettingsRow | null): TelegramSettingsView {
  return {
    enabled: row?.enabled ?? false,
    chatId: row?.telegram_chat_id ?? '',
    tokenConfigured: Boolean(row?.telegram_bot_token.trim()),
  }
}

export async function upsertTelegramSettings(
  client: SupabaseClient,
  input: {
    userId: string
    chatId: string
    botToken?: string
    enabled: boolean
  },
): Promise<UserTelegramSettingsRow> {
  const existing = await getTelegramSettings(client, input.userId)
  const chatId = input.chatId.trim()
  const botToken = input.botToken?.trim() ?? ''

  if (!chatId) {
    throw new Error('Укажите Telegram Chat ID.')
  }

  let resolvedToken = botToken
  if (!resolvedToken) {
    if (!existing?.telegram_bot_token.trim()) {
      throw new Error('Укажите токен Telegram-бота.')
    }
    resolvedToken = existing.telegram_bot_token
  }

  const patch = {
    user_id: input.userId,
    telegram_chat_id: chatId,
    telegram_bot_token: resolvedToken,
    enabled: input.enabled,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await client
    .from(TABLE)
    .upsert(patch, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw new Error(`Не удалось сохранить настройки Telegram: ${error.message}`)
  return data as UserTelegramSettingsRow
}

export async function deleteTelegramSettings(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.from(TABLE).delete().eq('user_id', userId)
  if (error) throw new Error(`Не удалось удалить настройки Telegram: ${error.message}`)
}
