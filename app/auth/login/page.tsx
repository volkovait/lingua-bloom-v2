'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'

import { createBrowserSupabaseClient } from '@/src/db/supabase-browser'
import { safeInternalPath } from '@/lib/auth/safe-next-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { GoogleAuthButton } from '@/components/auth/google-auth-button'
import logoImg from '@/assets/logo.png'
import { LABELS } from '@/lib/consts'

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <Spinner className="h-8 w-8 text-muted-foreground" />
    </div>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeInternalPath(searchParams.get('next'), '/')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createBrowserSupabaseClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setIsLoading(false)
      return
    }

    router.push(nextPath)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Link href="/auth/login" className="mb-3">
            <Image
              src={logoImg}
              alt={LABELS.AUTH_BRAND_LOGO_ALT}
              width={200}
              height={111}
              priority
              className="h-14 w-auto"
            />
          </Link>
          <p className="text-muted-foreground text-sm">{LABELS.AUTH_LOGIN_TAGLINE}</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-serif text-center">{LABELS.AUTH_SIGN_IN_TITLE}</CardTitle>
            <CardDescription className="text-center">{LABELS.AUTH_SIGN_IN_DESCRIPTION}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <GoogleAuthButton nextPath={nextPath} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span className="shrink-0">{LABELS.AUTH_OR_EMAIL}</span>
              <Separator className="flex-1" />
            </div>
            <form onSubmit={handleLogin}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">{LABELS.AUTH_EMAIL_LABEL}</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder={LABELS.AUTH_EMAIL_PLACEHOLDER}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">{LABELS.AUTH_PASSWORD_LABEL}</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder={LABELS.AUTH_PASSWORD_PLACEHOLDER}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>
              </FieldGroup>

              {error ? (
                <div className="flex items-center gap-2 text-destructive text-sm mt-4 p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full mt-6 gradient-bloom text-primary-foreground hover:opacity-90 transition-opacity"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    {LABELS.AUTH_SIGNING_IN}
                  </>
                ) : (
                  LABELS.AUTH_SIGN_IN_SUBMIT
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-sm text-center text-muted-foreground">
              {LABELS.AUTH_NO_ACCOUNT}{' '}
              <Link href="/auth/sign-up" className="text-primary hover:underline font-medium">
                {LABELS.AUTH_SIGN_UP_LINK}
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageInner />
    </Suspense>
  )
}
