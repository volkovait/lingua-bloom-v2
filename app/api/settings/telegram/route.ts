import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUserId } from '@/src/auth/session'
import { env } from '@/src/config/env'
import {
  getTelegramSettings,
  toTelegramSettingsView,
  upsertTelegramSettings,
} from '@/src/db/telegram-settings'
import { formatTelegramSettingsError } from '@/src/db/telegram-settings-errors'
import { createServiceRoleClient } from '@/src/db/supabase'
import { verifyTelegramBotToken } from '@/src/telegram/client'

export const runtime = 'nodejs'

const saveSchema = z.object({
  chatId: z.string().trim().min(1, 'Укажите Telegram Chat ID.').max(64),
  botToken: z.string().trim().max(256).optional(),
  enabled: z.boolean(),
})

function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Некорректные данные формы'
}

async function resolveBotTokenForSave(userId: string, botTokenFromForm: string): Promise<string> {
  if (botTokenFromForm.trim()) return botTokenFromForm.trim()

  const existing = await getTelegramSettings(createServiceRoleClient(), userId)
  if (existing?.telegram_bot_token.trim()) return existing.telegram_bot_token.trim()

  if (env.telegram.enabled()) return env.telegram.botToken()

  return ''
}

/** GET /api/settings/telegram — безопасное представление настроек (без токена). */
export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const row = await getTelegramSettings(createServiceRoleClient(), userId)
    const view = toTelegramSettingsView(row)

    if (!view.chatId && env.telegram.enabled()) {
      view.chatId = env.telegram.chatId()
    }

    return NextResponse.json({
      ...view,
      envFallbackAvailable: !row?.telegram_bot_token.trim() && env.telegram.enabled(),
    })
  } catch (error) {
    console.error('GET /api/settings/telegram failed:', error)
    return NextResponse.json(
      { error: formatTelegramSettingsError(error) },
      { status: 500 },
    )
  }
}

/** PUT /api/settings/telegram — сохранить chat id, токен и флаг включения. */
export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = saveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    const botToken = await resolveBotTokenForSave(userId, parsed.data.botToken ?? '')
    if (!botToken) {
      return NextResponse.json(
        { error: 'Укажите Bot Token от @BotFather (обязателен при первом сохранении).' },
        { status: 400 },
      )
    }

    const verified = await verifyTelegramBotToken(botToken)
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 400 })
    }

    const row = await upsertTelegramSettings(createServiceRoleClient(), {
      userId,
      chatId: parsed.data.chatId,
      botToken,
      enabled: parsed.data.enabled,
    })
    return NextResponse.json(toTelegramSettingsView(row))
  } catch (error) {
    console.error('PUT /api/settings/telegram failed:', error)
    const message = formatTelegramSettingsError(error)
    const status = message.includes('Укажите') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
