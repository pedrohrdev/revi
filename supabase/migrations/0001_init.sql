create extension if not exists pgcrypto;

create table contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]'),
  subject text,
  notes text,
  studied_at date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  interval_index int not null default 0 check (interval_index >= 0 and interval_index < 5),
  next_review_date date,
  status text not null default 'active' check (status in ('active','mastered','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint next_review_date_required_when_active
    check (status <> 'active' or next_review_date is not null)
);

create table review_logs (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  interval_index_at_review int not null check (interval_index_at_review >= 0 and interval_index_at_review < 5),
  reviewed_at timestamptz not null default now()
);

-- RLS habilitado desde a criação; policies entram em 0002.
alter table contents enable row level security;
alter table review_logs enable row level security;

create index idx_contents_due on contents (user_id, status, next_review_date);
create index idx_review_logs_content on review_logs (content_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contents_set_updated_at
  before update on contents
  for each row
  execute function set_updated_at();
