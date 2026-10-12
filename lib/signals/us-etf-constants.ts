// 저장·보고·대조·웹 열람이 함께 쓰는 US P1 식별 값. 쓰기 경로 모듈(node:crypto 등)을 끌어오지 않으려고 따로 둔다.
export const US_ETF_STRATEGY_VERSION = "m5-us-etf-movers-p1-v1";
export const US_ETF_SIGNAL_TYPES = [
  "daily_price_gain",
  "daily_price_loss",
  "five_day_price_gain",
  "five_day_price_loss",
] as const;
