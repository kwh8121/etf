insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'market-data-source-snapshots',
  'market-data-source-snapshots',
  false,
  10485760,
  array['application/json']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
