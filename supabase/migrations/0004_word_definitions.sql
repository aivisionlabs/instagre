-- Replace single definition + secondary_definition with a definitions array.

alter table public.words
  add column if not exists definitions text[] not null default '{}';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'words'
      and column_name = 'definition'
  ) then
    update public.words
    set definitions = coalesce(
      (
        select array_agg(trim(x) order by ord)
        from unnest(array[definition, secondary_definition]) with ordinality as t(x, ord)
        where x is not null and trim(x) <> ''
      ),
      '{}'
    )
    where cardinality(definitions) = 0;

    alter table public.words drop column definition;
    alter table public.words drop column if exists secondary_definition;
  end if;
end $$;
