-- Recreated from how the code uses the production schema, for local testing
-- only. Not verified against production: compare with
-- `supabase db dump --schema-only` before relying on details.

create table public.notes_contents (
  id text primary key,
  source text not null,
  source_version text not null,
  compiled text,
  compiled_source_version text,
  compiled_compiler_version text
);

create table public.notes_search_keys (
  search_key text primary key,
  note_id text not null
);

create table public.notes_settings (
  id text primary key,
  value jsonb
);

alter table public.notes_contents enable row level security;
alter table public.notes_search_keys enable row level security;
alter table public.notes_settings enable row level security;

-- The frontend reads settings once signed in.
create policy "signed-in users read settings" on public.notes_settings
  for select to authenticated using (true);

-- What the frontend calls to load an unlisted note by slug or alias.
create function public.notes_get_contents(input_search_key text)
returns table (
  id text,
  source text,
  source_version text,
  compiled text,
  compiled_source_version text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.source, c.source_version, c.compiled, c.compiled_source_version
  from notes_search_keys k
  join notes_contents c on c.id = k.note_id
  where k.search_key = input_search_key
$$;

grant execute on function public.notes_get_contents(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('notes-public', 'notes-public', true);
