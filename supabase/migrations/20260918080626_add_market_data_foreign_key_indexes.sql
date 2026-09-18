create index source_snapshot_duplicate_of_snapshot_id_idx
  on source_snapshot (duplicate_of_snapshot_id);

create index trading_calendar_kr_source_snapshot_id_idx
  on trading_calendar_kr (source_snapshot_id);

create index etf_daily_kr_source_snapshot_id_idx
  on etf_daily_kr (source_snapshot_id);

create index etf_master_kr_source_snapshot_id_idx
  on etf_master_kr (source_snapshot_id);

create index listing_event_kr_code_idx
  on listing_event_kr (code);

create index listing_event_kr_source_snapshot_id_idx
  on listing_event_kr (source_snapshot_id);

create index signal_daily_source_snapshot_id_idx
  on signal_daily (source_snapshot_id);
