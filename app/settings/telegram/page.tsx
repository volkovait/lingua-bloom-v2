import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { ProfileTelegramGuide } from '@/components/profile-telegram-guide'
import { TelegramSettingsForm } from '@/components/telegram-settings-form'
import { LABELS } from '@/lib/consts'
import { getCurrentUserId } from '@/src/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function TelegramSettingsPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login?next=/settings/telegram')

  return (
    <AppShell active="settings">
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 font-serif text-3xl font-bold text-primary">
          {LABELS.SETTINGS_PROFILE_PAGE_TITLE}
        </h1>
        <ProfileTelegramGuide />
        <TelegramSettingsForm />
      </main>
    </AppShell>
  )
}
