import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/src/auth/session'
import { getTelegramSettings } from '@/src/db/telegram-settings'
import { formatTelegramSettingsError } from '@/src/db/telegram-settings-errors'
import { createServiceRoleClient } from '@/src/db/supabase'
import { sendTelegramTestNotification } from '@/src/telegram/notifications'

export const runtime = 'nodejs'

/** POST /api/settings/telegram/test — отправить тестовое сообщение в Telegram. */
export async function POST() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const settings = await getTelegramSettings(createServiceRoleClient(), userId)
    if (
      !settings?.enabled ||
      !settings.telegram_chat_id.trim() ||
      !settings.telegram_bot_token.trim()
    ) {
      return NextResponse.json(
        { error: 'Сначала сохраните включённые настройки Telegram.' },
        { status: 400 },
      )
    }

    await sendTelegramTestNotification({
      botToken: settings.telegram_bot_token.trim(),
      chatId: settings.telegram_chat_id.trim(),
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('POST /api/settings/telegram/test failed:', error)
    const message = error instanceof Error ? error.message : 'Не удалось отправить тестовое сообщение'
    return NextResponse.json({ error: formatTelegramSettingsError(error) || message }, { status: 502 })
  }
}
