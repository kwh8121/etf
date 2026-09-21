-- KRX 백필은 최신 일자부터 수집될 수 있으므로, 거래일 순번은 삽입 순서가 아니라
-- TRADING_COMPLETE 기준일의 날짜 오름차순으로 재계산한다.
update trading_calendar_kr
set seq = -seq
where status = 'TRADING_COMPLETE'
  and seq is not null;

with ranked_days as (
  select bas_dd, row_number() over (order by bas_dd)::integer as seq
  from trading_calendar_kr
  where status = 'TRADING_COMPLETE'
)
update trading_calendar_kr calendar
set seq = ranked_days.seq
from ranked_days
where calendar.bas_dd = ranked_days.bas_dd;
