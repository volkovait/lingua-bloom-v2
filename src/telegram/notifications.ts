import type { TelegramDeliveryConfig } from './delivery'
import { escapeHtml, sendTelegramMessage } from './client'

export type TestResultRow = {
  serial: number
  ok: boolean
  studentLine: string
  correctLine: string
}

export async function notifyTestResults(
  delivery: TelegramDeliveryConfig,
  input: {
    lessonTitle: string
    studentName: string
    score: number
    max: number
    rows: TestResultRow[]
  },
): Promise<void> {
  const lines = [
    '📝 <b>Результаты теста</b>',
    `<b>${escapeHtml(input.lessonTitle.trim() || 'Тест')}</b>`,
    `Студент: ${escapeHtml(input.studentName.trim())}`,
    `Баллы: <b>${input.score}</b> из ${input.max}`,
    '',
  ]

  for (const row of input.rows) {
    lines.push(`${row.serial}. ${escapeHtml(row.studentLine)}`)
    if (!row.ok) {
      lines.push(`   Верно: ${escapeHtml(row.correctLine)}`)
    }
  }

  await sendTelegramMessage({
    botToken: delivery.botToken,
    chatId: delivery.chatId,
    text: lines.join('\n'),
  })
}

export async function sendTelegramTestNotification(
  delivery: TelegramDeliveryConfig,
): Promise<void> {
  await sendTelegramMessage({
    botToken: delivery.botToken,
    chatId: delivery.chatId,
    text: '✅ <b>Lingua Bloom</b>\nТестовое уведомление: Telegram настроен правильно.',
  })
}
