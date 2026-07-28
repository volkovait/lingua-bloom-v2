import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/src/db/supabase'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
