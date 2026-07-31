'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'

import logoImg from '@/assets/logo.png'
import { Button } from '@/components/ui/button'
import { LABELS } from '@/lib/consts'
import { cn } from '@/lib/utils'

const SIGNOUT_FORM_ID = 'app-shell-signout'

export type NavKey = 'create' | 'history' | 'settings'

const NAV_ITEMS: { href: string; label: string; key: NavKey }[] = [
  { href: '/', label: LABELS.CHAT_WITH_AI, key: 'create' },
  { href: '/history', label: LABELS.NAV_HISTORY_TESTS, key: 'history' },
  { href: '/settings/telegram', label: LABELS.NAV_TELEGRAM_SETTINGS, key: 'settings' },
]

interface AppShellProps {
  children: ReactNode
  active?: NavKey
  showSignOut?: boolean
}

function navButtonClass(isActive: boolean): string {
  return isActive
    ? 'border border-[#4056A1] bg-[#D79922] text-white hover:bg-[#c2891c] hover:text-white'
    : 'text-[#4056A1] hover:bg-[#D79922]/15'
}

/** Шапка: бренд, ссылки на создание/историю тестов и выход. */
export function AppShell({ children, active, showSignOut = true }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#EFE2BA] text-[#333333]">
      <header className="sticky top-0 z-50 border-b-2 border-[#C5CBE3] bg-[#EFE2BA]/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
          {showSignOut ? <form id={SIGNOUT_FORM_ID} action="/auth/signout" method="post" hidden /> : null}

          <Link href="/" className="flex min-w-0 items-center shrink-0">
            <Image
              src={logoImg}
              alt={LABELS.BRAND_LOGO_ALT}
              width={145}
              height={81}
              priority
              className="h-9 w-auto shrink-0"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <nav className="flex flex-wrap items-center justify-end gap-1">
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.key}
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(navButtonClass(active === item.key), 'px-2 sm:px-3')}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
              {showSignOut ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  form={SIGNOUT_FORM_ID}
                  className="gap-1 text-[#4056A1] hover:bg-[#D79922]/15"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{LABELS.SIGN_OUT}</span>
                </Button>
              ) : null}
            </nav>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
