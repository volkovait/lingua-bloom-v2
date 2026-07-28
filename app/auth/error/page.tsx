import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LABELS } from '@/lib/consts'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{LABELS.AUTH_ERROR_TITLE}</CardTitle>
            </CardHeader>
            <CardContent>
              {params.error ? (
                <p className="text-sm text-muted-foreground">
                  {LABELS.AUTH_ERROR_CODE_PREFIX}
                  {params.error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{LABELS.AUTH_ERROR_UNSPECIFIED}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
