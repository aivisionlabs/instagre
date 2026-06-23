-- Word content is public read (no Supabase Auth required).
-- Progress and profiles remain local-first until custom backend auth exists.

drop policy if exists words_select_authed on public.words;
drop policy if exists words_select_anon on public.words;

create policy words_select_anon on public.words
  for select to anon, authenticated using (true);

grant select on table public.words to anon;
