'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LABELS } from '@/lib/consts'
import { cn } from '@/lib/utils'

type RunEvent = { seq: number; emoji: string; title: string; detail: string | null }
type Interrupt =
  | { type: 'plan_approval'; planMarkdown: string }
  | { type: 'answers'; message: string }
  | null
type RunStatus = {
  status: 'running' | 'interrupted' | 'failed' | 'completed'
  phase: string
  lessonId: string | null
  errorMessage: string | null
  interrupt: Interrupt
}

export function ChatRunWorkspace(props: {
  defaultMaterialText?: string
  showSignOut?: boolean
}) {
  const [title, setTitle] = useState('')
  const [materialText, setMaterialText] = useState(props.defaultMaterialText ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [preferAutoAnswers, setPreferAutoAnswers] = useState(false)
  const [answersFlowAutoOnly, setAnswersFlowAutoOnly] = useState(false)

  const [runId, setRunId] = useState<string | null>(null)
  const [events, setEvents] = useState<RunEvent[]>([])
  const [run, setRun] = useState<RunStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const [planText, setPlanText] = useState('')
  const [answersText, setAnswersText] = useState('')

  const afterSeq = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const poll = useCallback(async (id: string) => {
    const response = await fetch(`/api/runs/${id}/events?afterSeq=${afterSeq.current}`)
    if (!response.ok) return
    const data = (await response.json()) as { run: RunStatus; events: RunEvent[] }
    if (data.events.length > 0) {
      afterSeq.current = data.events[data.events.length - 1].seq
      setEvents((previous) => [...previous, ...data.events])
    }
    setRun(data.run)
    if (data.run.interrupt?.type === 'plan_approval') {
      setPlanText(data.run.interrupt.planMarkdown)
    }
  }, [])

  useEffect(() => {
    if (!runId || !run) return
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'interrupted') return
    const timer = setInterval(() => void poll(runId), 1500)
    return () => clearInterval(timer)
  }, [runId, run, poll])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  useEffect(() => {
    setAnswersFlowAutoOnly(false)
  }, [run?.interrupt])

  async function startRun() {
    setFormError('')
    if (!materialText.trim() && files.length === 0) {
      setFormError(LABELS.CREATE_ERROR_NEED_MESSAGE)
      return
    }
    setBusy(true)
    const form = new FormData()
    form.set('title', title)
    form.set('text', materialText)
    form.set('autoSolve', String(preferAutoAnswers))
    for (const file of files) form.append('files', file)

    const response = await fetch('/api/runs', { method: 'POST', body: form })
    const data = (await response.json()) as { error?: string; runId?: string }
    setBusy(false)
    if (!response.ok) {
      setFormError(data.error ?? LABELS.CREATE_ERROR_GENERATION)
      return
    }
    afterSeq.current = 0
    setEvents([])
    setRun({ status: 'running', phase: 'init', lessonId: null, errorMessage: null, interrupt: null })
    setRunId(data.runId ?? null)
    if (data.runId) void poll(data.runId)
  }

  async function resume(resumeValue: unknown) {
    if (!runId) return
    setBusy(true)
    setRun((previous) => (previous ? { ...previous, status: 'running', interrupt: null } : previous))
    await fetch(`/api/runs/${runId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: resumeValue }),
    })
    setBusy(false)
    void poll(runId)
  }

  function resetRun() {
    setRunId(null)
    setRun(null)
    setEvents([])
    setFormError('')
    afterSeq.current = 0
  }

  const interrupt = run?.status === 'interrupted' ? run.interrupt : null
  const canStart = materialText.trim().length > 0 || files.length > 0
  const isRunning = busy || run?.status === 'running'

  return (
    <AppShell active="create" showSignOut={props.showSignOut}>
      <main className="container mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-2 font-serif text-3xl font-bold text-primary">{LABELS.CHAT_WITH_AI}</h1>

        {formError ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Card className="border-2 border-[#C5CBE3] bg-white shadow-sm">
          <CardContent className="flex min-h-0 flex-col gap-3 overflow-hidden p-4">
            {!runId ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-title">{LABELS.UPLOAD_LABEL_TITLE}</Label>
                  <Textarea
                    id="lesson-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    rows={1}
                    maxLength={500}
                    className="min-h-[40px] resize-none border-[#C5CBE3]"
                    placeholder={LABELS.UPLOAD_TITLE_PLACEHOLDER}
                    disabled={busy}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lesson-material">{LABELS.LESSON_RUN_MATERIAL_SLOT}</Label>
                  <p className="text-xs text-muted-foreground">{LABELS.LESSON_RUN_MATERIAL_HINT}</p>
                  <Textarea
                    id="lesson-material"
                    value={materialText}
                    onChange={(event) => setMaterialText(event.target.value)}
                    rows={8}
                    maxLength={240_000}
                    className="border-[#C5CBE3] bg-white text-sm"
                    disabled={busy}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lesson-pdf">{LABELS.LESSON_RUN_DROP_MATERIAL}</Label>
                  <input
                    id="lesson-pdf"
                    type="file"
                    accept="application/pdf"
                    multiple
                    disabled={busy}
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    className={cn(
                      'block w-full rounded-md border border-dashed border-[#C5CBE3] p-3 text-xs text-muted-foreground',
                      busy && 'pointer-events-none opacity-60',
                    )}
                  />
                  {files.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFiles([])}
                      disabled={busy}
                    >
                      {LABELS.LESSON_RUN_CLEAR_FILES}
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-start gap-2 rounded-md border border-[#C5CBE3]/80 bg-muted/20 p-2">
                  <Checkbox
                    id="lesson-prefer-auto-answers"
                    checked={preferAutoAnswers}
                    onCheckedChange={(checked) => setPreferAutoAnswers(checked === true)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="lesson-prefer-auto-answers"
                    className="cursor-pointer text-xs leading-snug text-muted-foreground"
                  >
                    {LABELS.LESSON_RUN_PREFER_AUTO_ANSWERS}
                  </label>
                </div>

                <Button
                  type="button"
                  className="btn-cta-gold w-full border-0"
                  disabled={busy || !canStart}
                  onClick={() => void startRun()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {LABELS.LESSON_RUN_START}
                </Button>
              </>
            ) : (
              <>
                {(events.length > 0 || isRunning) && (
                  <div className="rounded-md border border-[#D79922]/40 bg-[#EFE2BA]/20 p-3">
                    <p className="mb-2 text-xs font-medium text-[#4056A1]">{LABELS.LESSON_RUN_LOG_TITLE}</p>
                    <div className="max-h-60 overflow-y-auto">
                      {events.length > 0 ? (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {events.map((eventItem) => (
                            <li key={eventItem.seq}>
                              {eventItem.emoji} {eventItem.title}
                              {eventItem.detail ? ` — ${eventItem.detail}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">{LABELS.LESSON_RUN_WAITING_FIRST_STEP}</p>
                      )}
                      <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
                    </div>
                  </div>
                )}

                {isRunning && !interrupt ? <GenerationBusyHint /> : null}

                {interrupt?.type === 'plan_approval' ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-[#4056A1]/50 p-3">
                    <p className="text-sm font-medium">{LABELS.LESSON_RUN_PLAN_LABEL}</p>
                    <Textarea
                      value={planText}
                      onChange={(event) => setPlanText(event.target.value)}
                      rows={10}
                      className="border-[#C5CBE3] font-mono text-xs"
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      onClick={() => void resume({ editedPlanMarkdown: planText })}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {LABELS.LESSON_RUN_ACCEPT_PLAN}
                    </Button>
                  </div>
                ) : null}

                {interrupt?.type === 'answers' ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-[#4056A1]/50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={answersFlowAutoOnly ? 'outline' : 'secondary'}
                        onClick={() => setAnswersFlowAutoOnly(false)}
                        disabled={busy}
                      >
                        {LABELS.LESSON_RUN_ANSWERS_MODE_MANUAL}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={answersFlowAutoOnly ? 'secondary' : 'outline'}
                        onClick={() => setAnswersFlowAutoOnly(true)}
                        disabled={busy}
                      >
                        {LABELS.LESSON_RUN_ANSWERS_MODE_AUTO}
                      </Button>
                    </div>
                    <p className="text-sm">{interrupt.message}</p>
                    {!answersFlowAutoOnly ? (
                      <>
                        <Label htmlFor="lesson-answers-resume">{LABELS.LESSON_RUN_ANSWERS_LABEL}</Label>
                        <Textarea
                          id="lesson-answers-resume"
                          value={answersText}
                          onChange={(event) => setAnswersText(event.target.value)}
                          rows={5}
                          disabled={busy}
                        />
                      </>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {!answersFlowAutoOnly ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void resume({ answersText })}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {LABELS.LESSON_RUN_SEND_RESUME}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void resume({ autoSolve: true })}
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {LABELS.LESSON_RUN_AUTO_BUTTON}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {run?.status === 'completed' && run.lessonId ? (
                  <div className="space-y-3 rounded-lg border border-success/40 bg-success/10 p-3">
                    <p className="font-medium text-success">{LABELS.LESSON_RUN_READY}</p>
                    <Button asChild className="btn-cta-gold border-0">
                      <Link href={`/learn/${run.lessonId}`}>{LABELS.LESSON_RUN_OPEN}</Link>
                    </Button>
                  </div>
                ) : null}

                {run?.status === 'failed' ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                    <p className="font-medium">{LABELS.LESSON_RUN_FAILED_TITLE}</p>
                    {run.errorMessage ? <p className="mt-1 text-sm">{run.errorMessage}</p> : null}
                  </div>
                ) : null}

                <Button type="button" variant="ghost" size="sm" onClick={resetRun} className="self-start">
                  {LABELS.LESSON_RUN_NEW_TEST}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  )
}

function GenerationBusyHint() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const elapsedLabel =
    elapsedSeconds < 60
      ? `${elapsedSeconds} с`
      : `${Math.floor(elapsedSeconds / 60)} мин ${elapsedSeconds % 60} с`

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-lg border border-[#4056A1]/30 bg-[#4056A1]/5 p-3"
    >
      <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#4056A1]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium text-[#4056A1]">
          <span className="animate-pulse">{LABELS.LESSON_RUN_BUSY_HINT_TITLE}</span>
          <span className="ml-1 inline-flex gap-0.5" aria-hidden>
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#4056A1]" />
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#4056A1]"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#4056A1]"
              style={{ animationDelay: '300ms' }}
            />
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{LABELS.LESSON_RUN_BUSY_HINT_SUBTITLE}</p>
        <p className="mt-1 text-[11px] font-medium text-[#4056A1]/80">Прошло: {elapsedLabel}</p>
      </div>
    </div>
  )
}
