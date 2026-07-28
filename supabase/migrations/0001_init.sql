-- Lingua Bloom v2 — консолидированная схема.
-- Три таблицы: lessons, lesson_generation_runs, lesson_generation_events.
-- LangGraph checkpointer создаёт свои таблицы отдельно (PostgresSaver.setup()).

create extension if not exists "pgcrypto";

-- ── lessons ──────────────────────────────────────────────────────────
create table if not exists public.lessons (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  source_type       text not null check (source_type in ('pdf', 'text')),
  html_body         text not null,
  spec_json         jsonb not null,
  meta              jsonb not null default '{}'::jsonb,
  generation_run_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists lessons_user_id_created_at_idx
  on public.lessons (user_id, created_at desc);

-- ── lesson_generation_runs ───────────────────────────────────────────
create table if not exists public.lesson_generation_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  thread_id     text not null unique,
  status        text not null default 'running'
                  check (status in ('running', 'interrupted', 'failed', 'completed')),
  phase         text not null default 'init',
  mode          text check (mode in ('ready_material', 'raw_material')),
  lesson_id     uuid references public.lessons (id) on delete set null,
  error_code    text,
  error_message text,
  title         text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists lesson_generation_runs_user_id_created_at_idx
  on public.lesson_generation_runs (user_id, created_at desc);

-- ── lesson_generation_events (append-only лог прогона) ────────────────
create table if not exists public.lesson_generation_events (
  id         bigserial primary key,
  run_id     uuid not null references public.lesson_generation_runs (id) on delete cascade,
  seq        bigint not null,
  emoji      text not null default '',
  title      text not null,
  detail     text,
  node_id    text,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

create index if not exists lesson_generation_events_run_id_seq_idx
  on public.lesson_generation_events (run_id, seq);

-- ── RLS: own user only ───────────────────────────────────────────────
alter table public.lessons enable row level security;
alter table public.lesson_generation_runs enable row level security;
alter table public.lesson_generation_events enable row level security;

drop policy if exists lessons_owner on public.lessons;
create policy lessons_owner on public.lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists runs_owner on public.lesson_generation_runs;
create policy runs_owner on public.lesson_generation_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists events_owner on public.lesson_generation_events;
create policy events_owner on public.lesson_generation_events
  for all using (
    exists (
      select 1 from public.lesson_generation_runs r
      where r.id = lesson_generation_events.run_id and r.user_id = auth.uid()
    )
  );

-- Service-role ключ обходит RLS автоматически (серверные записи при AUTH_DISABLED).
