const TELEGRAM_MESSAGE_LIMIT = 4096

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function splitMessage(text: string, limit: number): string[] {
  if (text.length <= limit) return [text]

  const chunks: string[] = []
  let rest = text
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit)
    if (cut < Math.floor(limit / 2)) cut = limit
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.length > 0) chunks.push(rest)
  return chunks
}

export async function verifyTelegramBotToken(botToken: string): Promise<{ ok: true; username?: string } | { ok: false; error: string }> {
  const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`)
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean
    result?: { username?: string }
    description?: string
  } | null

  if (!response.ok || !payload?.ok) {
    const description = payload?.description ?? `Telegram API вернул ${response.status}`
    if (description === 'Not Found' || description.includes('Not Found')) {
      return { ok: false, error: 'Неверный Bot Token. Скопируйте token заново из @BotFather.' }
    }
    return { ok: false, error: description }
  }

  return { ok: true, username: payload.result?.username }
}

export async function sendTelegramMessage(input: {
  text: string
  botToken: string
  chatId: string
  disableNotification?: boolean
}): Promise<void> {
  const token = input.botToken.trim()
  const chatId = input.chatId.trim()
  if (!token || !chatId) {
    throw new Error('Не заданы bot token или chat id для Telegram.')
  }

  const chunks = splitMessage(input.text, TELEGRAM_MESSAGE_LIMIT)

  for (const chunk of chunks) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_notification: input.disableNotification ?? false,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`)
    }
  }
}
