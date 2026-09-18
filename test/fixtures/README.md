# 테스트 fixture 규칙

- 실제 API 키, OAuth 토큰, Supabase 서비스 역할 키, Telegram 토큰, 쿠키를 넣지 않는다.
- KRX·Kiwoom 전체 원본 응답을 그대로 저장하지 않는다. 필요한 필드와 경계 사례만 최소화해 만든다.
- fixture 파일명은 원천·API ID·상태를 표현한다. 예: `krx-etf_bydd_trd-complete.json`.
- 민감정보가 의심되는 문자열은 실제 값 대신 `redacted-*` 형식의 명시적 가짜 값으로 바꾼다.
- 실제 API probe 결과는 비공개 운영 저장소에 두고, Git fixture에는 정규화된 최소 사례만 옮긴다.
