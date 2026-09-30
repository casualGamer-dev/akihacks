-- Run in the Supabase SQL editor. Safe to re-run: everything is "if not exists".
-- RLS is on with no policies everywhere: only the server's secret key can touch these tables.

-- Site content: one row per editable section.
create table if not exists public.site_content (
  section    text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content add column if not exists updated_by text;
alter table public.site_content enable row level security;

-- Every save, so an edit can be undone.
create table if not exists public.site_content_history (
  id       bigint generated always as identity primary key,
  section  text not null,
  value    jsonb not null,
  saved_by text,
  saved_at timestamptz not null default now()
);
create index if not exists site_content_history_section_idx on public.site_content_history (section, saved_at desc);
alter table public.site_content_history enable row level security;

-- Admin accounts (passwords are scrypt hashes, never plain text).
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'editor' check (role in ('owner', 'editor')),
  created_at    timestamptz not null default now(),
  last_login    timestamptz
);
alter table public.admin_users enable row level security;

-- Failed sign-ins, for lockout.
create table if not exists public.admin_login_attempts (
  id  bigint generated always as identity primary key,
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists admin_login_attempts_idx on public.admin_login_attempts (key, at);
alter table public.admin_login_attempts enable row level security;

notify pgrst, 'reload schema';
