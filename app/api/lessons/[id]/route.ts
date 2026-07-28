import { NextResponse } from 'next/server'

import { isAuthDisabled } from '@/src/auth/auth-disabled'
import { getCurrentUserId } from '@/src/auth/session'
import { deleteLesson, getLesson } from '@/src/db/lessons'
import { createServiceRoleClient } from '@/src/db/supabase'

export const runtime = 'nodejs'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const client = createServiceRoleClient()
  const lesson = await getLesson(client, id)
  if (!lesson) return NextResponse.json({ error: 'Урок не найден' }, { status: 404 })
  if (!isAuthDisabled() && lesson.user_id !== userId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  return NextResponse.json({ lesson })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const client = createServiceRoleClient()
  const lesson = await getLesson(client, id)
  if (!lesson) return NextResponse.json({ error: 'Урок не найден' }, { status: 404 })
  if (!isAuthDisabled() && lesson.user_id !== userId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }
  await deleteLesson(client, id)
  return NextResponse.json({ ok: true })
}
