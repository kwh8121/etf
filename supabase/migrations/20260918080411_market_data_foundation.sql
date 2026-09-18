create table source_snapshot (
  id uuid primary key default gen_random_uuid(),
  observation_key text unique not null,
  market text not null check (market in ('KR', 'US')),
  source text not null,
  api_id text not null,
  requested_asof date,
  market_date date,
  asof_at timestamptz,
  observed_at timestamptz not null default now(),
  status text not null,
  http_status integer,
  return_code text,
  row_count integer not null default 0,
  unique_key_count integer,
  page_count integer not null default 1,
  sha256 text not null,
  duplicate_of_snapshot_id uuid references source_snapshot(id),
  transform_version text not null,
  object_path text,
  error_code text,
  error_message text
);

create index source_snapshot_content_lookup
  on source_snapshot (market, api_id, coalesce(market_date, date '0001-01-01'), sha256);

create table trading_calendar_kr (
  bas_dd date primary key,
  seq integer unique,
  status text not null,
  source_snapshot_id uuid references source_snapshot(id)
);

create table etf_daily_kr (
  bas_dd date not null,
  isu_cd text not null,
  isu_nm text not null,
  open_prc numeric,
  high_prc numeric,
  low_prc numeric,
  close_prc numeric not null,
  fluc_rt numeric,
  nav numeric not null,
  acc_trdvol numeric not null,
  acc_trdval numeric not null,
  mktcap numeric,
  net_asset numeric,
  list_shrs numeric,
  idx_nm text,
  idx_close numeric,
  idx_fluc_rt numeric,
  quality text not null default 'ok',
  source_snapshot_id uuid references source_snapshot(id),
  primary key (bas_dd, isu_cd)
);

create table etf_master_kr (
  code text primary key,
  name text not null,
  reg_day date,
  market_code text,
  market_name text,
  state text,
  first_seen date not null,
  last_seen date not null,
  first_alerted_at timestamptz,
  source_snapshot_id uuid references source_snapshot(id)
);

create table listing_event_kr (
  event_key text primary key,
  code text not null references etf_master_kr(code),
  reg_day date,
  first_seen date not null,
  new_in_snapshot boolean not null,
  first_alerted_at timestamptz,
  source_snapshot_id uuid references source_snapshot(id)
);

create table signal_run (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('KR', 'US')),
  bas_dd date,
  market_date date,
  asof_at timestamptz,
  observed_at timestamptz not null default now(),
  strategy_version text not null,
  transform_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  input_snapshot_ids uuid[] not null,
  notes jsonb not null default '{}'::jsonb
);

create table signal_daily (
  run_id uuid not null references signal_run(id),
  market text not null check (market in ('KR', 'US')),
  bas_dd date,
  market_date date,
  observed_at timestamptz not null,
  asof_at timestamptz,
  signal_type text not null,
  code text not null,
  name text not null,
  screen text not null check (screen in ('raw', 'liquid')),
  rank integer,
  value numeric,
  value_unit text,
  liquidity_value numeric,
  is_experimental boolean not null default false,
  source_snapshot_id uuid references source_snapshot(id),
  meta jsonb not null default '{}'::jsonb,
  primary key (run_id, market, signal_type, screen, code)
);

alter table source_snapshot enable row level security;
alter table trading_calendar_kr enable row level security;
alter table etf_daily_kr enable row level security;
alter table etf_master_kr enable row level security;
alter table listing_event_kr enable row level security;
alter table signal_run enable row level security;
alter table signal_daily enable row level security;

create policy "Authenticated users can read trading calendar"
  on trading_calendar_kr for select to authenticated using (true);

create policy "Authenticated users can read daily ETF data"
  on etf_daily_kr for select to authenticated using (true);

create policy "Authenticated users can read ETF master data"
  on etf_master_kr for select to authenticated using (true);

create policy "Authenticated users can read listing events"
  on listing_event_kr for select to authenticated using (true);

create policy "Authenticated users can read signal runs"
  on signal_run for select to authenticated using (true);

create policy "Authenticated users can read signal results"
  on signal_daily for select to authenticated using (true);
