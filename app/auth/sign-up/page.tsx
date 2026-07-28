'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { createBrowserSupabaseClient } from '@/src/db/supabase-browser'
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
import { getOAuthRedirectOrigin } from '@/lib/auth/oauth-redirect-origin'
import logoImg from '@/assets/logo.png'
import { LABELS } from '@/lib/consts'

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(LABELS.AUTH_PASSWORD_MISMATCH)
      return
    }

    if (password.length < 6) {
      setError(LABELS.AUTH_PASSWORD_MIN_LENGTH)
      return
    }

    setIsLoading(true)

    const supabase = createBrowserSupabaseClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getOAuthRedirectOrigin()}/auth/callback`,
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsLoading(false)
      return
    }

    setIsSuccess(true)
    setIsLoading(false)
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
        <Card className="w-full max-w-md border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full gradient-bloom flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-serif">{LABELS.AUTH_EMAIL_CHECK_TITLE}</CardTitle>
            <CardDescription className="mt-2">
              {LABELS.AUTH_EMAIL_CHECK_BEFORE}
              <strong>{email}</strong>
              {LABELS.AUTH_EMAIL_CHECK_AFTER}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/auth/login">
              <Button variant="outline">{LABELS.AUTH_BACK_TO_SIGN_IN}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
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
          <p className="text-center text-sm font-medium text-foreground">{LABELS.AUTH_SIGNUP_TAGLINE}</p>
        </div>

        <Card className="mb-6 border-border/50 bg-muted/40 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-center font-serif text-lg">
              {LABELS.AUTH_SIGNUP_PITCH_TITLE}
            </CardTitle>
            <CardDescription className="text-center text-sm">
              {LABELS.AUTH_SIGNUP_PITCH_AUDIENCE}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D79922]" aria-hidden />
                <span>{LABELS.AUTH_SIGNUP_PITCH_1}</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D79922]" aria-hidden />
                <span>{LABELS.AUTH_SIGNUP_PITCH_2}</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D79922]" aria-hidden />
                <span>{LABELS.AUTH_SIGNUP_PITCH_3}</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D79922]" aria-hidden />
                <span>{LABELS.AUTH_SIGNUP_PITCH_4}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-serif text-center">{LABELS.AUTH_SIGNUP_TITLE}</CardTitle>
            <CardDescription className="text-center">{LABELS.AUTH_SIGNUP_DESCRIPTION}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <GoogleAuthButton nextPath="/" label={LABELS.AUTH_GOOGLE_SIGN_UP} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span className="shrink-0">{LABELS.AUTH_OR_EMAIL}</span>
              <Separator className="flex-1" />
            </div>
            <form onSubmit={handleSignUp}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="displayName">{LABELS.AUTH_DISPLAY_NAME_LABEL}</FieldLabel>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder={LABELS.AUTH_DISPLAY_NAME_PLACEHOLDER}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={isLoading}
                  />
                </Field>
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
                    placeholder={LABELS.AUTH_PASSWORD_CREATE_PLACEHOLDER}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmPassword">{LABELS.AUTH_CONFIRM_PASSWORD_LABEL}</FieldLabel>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={LABELS.AUTH_CONFIRM_PASSWORD_PLACEHOLDER}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
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
                    {LABELS.AUTH_CREATING_ACCOUNT}
                  </>
                ) : (
                  LABELS.AUTH_CREATE_ACCOUNT_SUBMIT
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-sm text-center text-muted-foreground">
              {LABELS.AUTH_HAVE_ACCOUNT}{' '}
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                {LABELS.AUTH_SIGN_IN_LINK}
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
