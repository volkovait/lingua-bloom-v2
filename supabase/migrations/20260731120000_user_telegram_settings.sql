-- Per-teacher Telegram credentials for test result notifications.

create table if not exists public.user_telegram_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  telegram_chat_id text not null,
  telegram_bot_token text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_telegram_settings enable row level security;

-- Доступ только через service role на сервере (токен бота не отдаём клиенту).
