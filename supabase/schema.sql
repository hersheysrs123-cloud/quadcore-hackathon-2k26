-- ============================================================================
-- SocraticOS — initial database schema
-- Paste this whole file into the Supabase SQL Editor and hit Run.
-- Idempotent: safe to re-run while you're iterating during the hackathon.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
-- block_type and socratic_status are fixed domains the app branches on, so they
-- get real Postgres enums. spaces.name uses a CHECK constraint instead (see
-- below) because user-named spaces are the obvious next feature and relaxing a
-- CHECK is one line, whereas altering an enum in use is not.

-- Mirrors EDITOR_TYPES in lib/blockMapping.js. `heading` covers h1/h2/h3 —
-- the level lives in content_json.level rather than getting its own enum value.
do $$ begin
  create type public.block_type as enum (
    'text', 'heading', 'bullet', 'code', 'media', 'socratic', 'action'
  );
exception when duplicate_object then null; end $$;

-- Tops up a database created before the editor block types existed. The DO
-- block above is a no-op once the type exists, so these have to be separate
-- statements. They must also stay OUTSIDE a transaction that then uses the new
-- values: Postgres only makes an added enum value usable after the adding
-- transaction commits.
alter type public.block_type add value if not exists 'bullet';
alter type public.block_type add value if not exists 'code';
alter type public.block_type add value if not exists 'action';

do $$ begin
  create type public.socratic_status as enum ('active', 'completed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- spaces ---------------------------------------------------------------------
create table if not exists public.spaces (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),

  -- Drop this constraint when you want arbitrary user-named spaces.
  constraint spaces_name_check check (name in ('School', 'Personal', 'Misc')),
  -- Lets the new-user seeder below re-run without creating duplicates.
  constraint spaces_user_name_unique unique (user_id, name)
);

-- notes ----------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces (id) on delete cascade,
  title      text not null default 'Untitled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- blocks ---------------------------------------------------------------------
-- order_index is double precision, not integer, on purpose: inserting a block
-- between two others is (prev + next) / 2 instead of renumbering every row
-- below it. Worth it the first time someone drags a block in the demo.
create table if not exists public.blocks (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes (id) on delete cascade,
  order_index  double precision not null default 0,
  block_type   public.block_type not null default 'text',
  content_json jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- socratic_sessions ----------------------------------------------------------
-- conversation_history is the raw Anthropic messages array:
--   [{ "role": "user" | "assistant", "content": "..." }, ...]
-- heatmap_json is the diagnostic scorecard the Duck produces:
--   { "concepts": [{ "concept": "...", "confidence": 0.4, "evidence": "..." }] }
create table if not exists public.socratic_sessions (
  id                   uuid primary key default gen_random_uuid(),
  block_id             uuid not null references public.blocks (id) on delete cascade,
  concept_name         text not null,
  conversation_history jsonb not null default '[]'::jsonb,
  status               public.socratic_status not null default 'active',
  heatmap_json         jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- One live session per block keeps the UI unambiguous; completed sessions are
-- archived by flipping status, not by inserting a second active row.
create unique index if not exists socratic_sessions_one_active_per_block
  on public.socratic_sessions (block_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
create index if not exists spaces_user_id_idx             on public.spaces (user_id);
create index if not exists notes_space_id_idx             on public.notes (space_id);
create index if not exists notes_updated_at_idx           on public.notes (updated_at desc);
create index if not exists blocks_note_id_order_idx       on public.blocks (note_id, order_index);
create index if not exists socratic_sessions_block_id_idx on public.socratic_sessions (block_id);

-- ---------------------------------------------------------------------------
-- 4. notes.updated_at auto-touch
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- Editing a block should bump the parent note's updated_at too, otherwise the
-- "recently edited" list in the sidebar lies.
create or replace function public.touch_parent_note()
returns trigger
language plpgsql
as $$
declare
  v_note_id uuid;
begin
  -- NEW is unassigned on DELETE, so branch rather than coalescing: touching
  -- new.note_id in a delete trigger raises "record new is not assigned yet".
  if tg_op = 'DELETE' then
    v_note_id := old.note_id;
  else
    v_note_id := new.note_id;
  end if;

  update public.notes
     set updated_at = now()
   where id = v_note_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists blocks_touch_parent_note on public.blocks;
create trigger blocks_touch_parent_note
  after insert or update or delete on public.blocks
  for each row execute function public.touch_parent_note();

-- ---------------------------------------------------------------------------
-- 5. Ownership helpers
-- ---------------------------------------------------------------------------
-- security definer so the policies below can walk up the ownership chain
-- (block -> note -> space -> user) without recursing into RLS on each hop.

create or replace function public.owns_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spaces s
     where s.id = p_space_id
       and s.user_id = auth.uid()
  );
$$;

create or replace function public.owns_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.notes n
      join public.spaces s on s.id = n.space_id
     where n.id = p_note_id
       and s.user_id = auth.uid()
  );
$$;

create or replace function public.owns_block(p_block_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.blocks b
      join public.notes  n on n.id = b.note_id
      join public.spaces s on s.id = n.space_id
     where b.id = p_block_id
       and s.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
-- NOTE: these policies key off auth.uid(), so they deny everything until a user
-- is actually signed in. Until you wire up Supabase Auth, the API routes reach
-- the database with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. See the
-- DEV MODE block at the bottom of this file if you'd rather open it up.

alter table public.spaces             enable row level security;
alter table public.notes              enable row level security;
alter table public.blocks             enable row level security;
alter table public.socratic_sessions  enable row level security;

drop policy if exists "spaces: owner" on public.spaces;
create policy "spaces: owner" on public.spaces
  for all
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notes: owner" on public.notes;
create policy "notes: owner" on public.notes
  for all
  using      (public.owns_space(space_id))
  with check (public.owns_space(space_id));

drop policy if exists "blocks: owner" on public.blocks;
create policy "blocks: owner" on public.blocks
  for all
  using      (public.owns_note(note_id))
  with check (public.owns_note(note_id));

drop policy if exists "socratic_sessions: owner" on public.socratic_sessions;
create policy "socratic_sessions: owner" on public.socratic_sessions
  for all
  using      (public.owns_block(block_id))
  with check (public.owns_block(block_id));

-- ---------------------------------------------------------------------------
-- 7. Seed School / Personal / Misc for every new user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.spaces (user_id, name)
  values (new.id, 'School'), (new.id, 'Personal'), (new.id, 'Misc')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 8. DEV MODE (optional) — uncomment while auth is not wired up yet
-- ---------------------------------------------------------------------------
-- These let the anon key read/write everything. Convenient for a demo, wide
-- open for anyone with your anon key. Delete before anything ships.
--
-- create policy "DEV: anon full access" on public.spaces            for all using (true) with check (true);
-- create policy "DEV: anon full access" on public.notes             for all using (true) with check (true);
-- create policy "DEV: anon full access" on public.blocks            for all using (true) with check (true);
-- create policy "DEV: anon full access" on public.socratic_sessions for all using (true) with check (true);
