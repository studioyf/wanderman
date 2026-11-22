-- WanderMan's server tables. Paste into Supabase: SQL Editor, New query, Run. Safe to run twice.
-- Every row of the app is kept as one record: its kind (trip, place, stop...), its trip, its contents.
create table if not exists public.records (
  id uuid not null,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  trip_id uuid,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists records_owner_server_at on public.records (owner, server_at);
create index if not exists records_trip on public.records (trip_id);

-- The server's own clock marks when each record arrived, so each device can ask for "everything since".
create or replace function public.records_stamp() returns trigger language plpgsql as $$
begin new.server_at := now(); return new; end $$;
drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records for each row execute function public.records_stamp();

-- Each person sees and changes only their own records. Shared trips (V2) will add a members table here.
alter table public.records enable row level security;
drop policy if exists "own records" on public.records;
create policy "own records" on public.records for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- Newer Supabase projects no longer open new tables to signed-in people by default: say so explicitly.
grant select, insert, update, delete on public.records to authenticated;
