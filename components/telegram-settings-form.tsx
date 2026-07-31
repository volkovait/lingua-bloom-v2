'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LABELS } from '@/lib/consts'

type SettingsView = {
  enabled: boolean
  chatId: string
  tokenConfigured: boolean
  envFallbackAvailable?: boolean
  error?: string
}

async function readJsonResponse<T extends { error?: string }>(
  response: Response,
): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    return { error: `Ошибка сервера (${response.status})` } as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return { error: `Ошибка сервера (${response.status})` } as T
  }
}

export function TelegramSettingsForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tokenConfigured, setTokenConfigured] = useState(false)
  const [envFallbackAvailable, setEnvFallbackAvailable] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [chatId, setChatId] = useState('')
  const [botToken, setBotToken] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/settings/telegram')
        const data = await readJsonResponse<SettingsView>(response)
        if (!response.ok) {
          setError(data.error ?? LABELS.SETTINGS_TELEGRAM_LOAD_ERROR)
          return
        }
        setEnabled(data.enabled)
        setChatId(data.chatId)
        setTokenConfigured(data.tokenConfigured)
        setEnvFallbackAvailable(Boolean(data.envFallbackAvailable))
      } catch {
        setError(LABELS.SETTINGS_TELEGRAM_LOAD_ERROR)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!chatId.trim()) {
      setError(LABELS.SETTINGS_TELEGRAM_CHAT_ID_REQUIRED)
      return
    }

    if (!tokenConfigured && !botToken.trim() && !envFallbackAvailable) {
      setError(LABELS.SETTINGS_TELEGRAM_TOKEN_REQUIRED)
      return
    }

    setSaving(true)

    const response = await fetch('/api/settings/telegram', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled,
        chatId,
        ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
      }),
    })
    const data = await readJsonResponse<SettingsView>(response)
    setSaving(false)

    if (!response.ok) {
      setError(data.error ?? LABELS.SETTINGS_TELEGRAM_SAVE_ERROR)
      return
    }

    setTokenConfigured(data.tokenConfigured)
    setBotToken('')
    setSuccess(LABELS.SETTINGS_TELEGRAM_SAVE_SUCCESS)
  }

  async function handleTest() {
    setTesting(true)
    setError('')
    setSuccess('')

    const response = await fetch('/api/settings/telegram/test', { method: 'POST' })
    const data = await readJsonResponse<{ error?: string }>(response)
    setTesting(false)

    if (!response.ok) {
      setError(data.error ?? LABELS.SETTINGS_TELEGRAM_TEST_ERROR)
      return
    }

    setSuccess(LABELS.SETTINGS_TELEGRAM_TEST_SUCCESS)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {LABELS.SETTINGS_TELEGRAM_LOADING}
      </div>
    )
  }

  return (
    <Card className="border-2 border-[#C5CBE3] bg-white shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={(event) => void handleSave(event)} className="space-y-5">
          <div>
            <h2 className="font-serif text-xl font-semibold text-primary">{LABELS.SETTINGS_TELEGRAM_TITLE}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{LABELS.SETTINGS_TELEGRAM_SUBTITLE}</p>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              {success}
            </p>
          ) : null}

          <FieldGroup>
            <Field>
              <div className="flex items-start gap-2 rounded-md border border-[#C5CBE3]/80 bg-muted/20 p-3">
                <Checkbox
                  id="telegram-enabled"
                  checked={enabled}
                  onCheckedChange={(checked) => setEnabled(checked === true)}
                />
                <label htmlFor="telegram-enabled" className="cursor-pointer text-sm leading-snug">
                  {LABELS.SETTINGS_TELEGRAM_ENABLED}
                </label>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="telegram-chat-id">{LABELS.SETTINGS_TELEGRAM_CHAT_ID}</FieldLabel>
              <Input
                id="telegram-chat-id"
                value={chatId}
                onChange={(event) => setChatId(event.target.value)}
                placeholder="385632170"
                inputMode="numeric"
                className="border-[#C5CBE3]"
              />
              <FieldDescription>{LABELS.SETTINGS_TELEGRAM_CHAT_ID_HINT}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="telegram-bot-token">{LABELS.SETTINGS_TELEGRAM_BOT_TOKEN}</FieldLabel>
              <Input
                id="telegram-bot-token"
                type="password"
                value={botToken}
                onChange={(event) => setBotToken(event.target.value)}
                placeholder={
                  tokenConfigured
                    ? LABELS.SETTINGS_TELEGRAM_BOT_TOKEN_KEEP
                    : LABELS.SETTINGS_TELEGRAM_BOT_TOKEN_PLACEHOLDER
                }
                autoComplete="off"
                className="border-[#C5CBE3]"
              />
              <FieldDescription>{LABELS.SETTINGS_TELEGRAM_BOT_TOKEN_HINT}</FieldDescription>
            </Field>
          </FieldGroup>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving} className="btn-cta-gold border-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {LABELS.SETTINGS_TELEGRAM_SAVE}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || !tokenConfigured}
              onClick={() => void handleTest()}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {LABELS.SETTINGS_TELEGRAM_TEST}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
