# Repository Guidelines

## 프로젝트 구조와 모듈 구성

이 저장소는 Next.js 16 App Router와 Supabase SSR을 사용하는 TypeScript 애플리케이션이다. 페이지와 Route Handler는 `app/`에 두고, 재사용 컴포넌트는 `components/`, shadcn/ui 기반 요소는 `components/ui/`에 둔다. Supabase 브라우저·서버·프록시 클라이언트는 `lib/supabase/`에서 관리한다. 정적 이미지는 `public/` 또는 `app/`의 메타데이터 이미지로 관리한다. 계획서는 `docs/plans/`, API 조사 자료는 `docs/references/`, 운영 지침은 `docs/guides/`에 저장한다. 신규 및 수정 문서는 한국어로 작성하되 API ID, 필드명, 코드, 명령어는 원문을 유지한다.

## 빌드, 검사 및 개발 명령

- `npm install`: `package-lock.json` 기준으로 의존성을 설치한다.
- `npm run dev`: `http://localhost:3000`에서 개발 서버를 실행한다.
- `npm run lint`: ESLint의 Next.js Core Web Vitals와 TypeScript 규칙을 검사한다.
- `npm run build`: 프로덕션 빌드와 TypeScript 검사를 수행한다.
- `npm run start`: 완료된 프로덕션 빌드를 로컬에서 실행한다.

변경 제출 전 최소한 `npm run lint`와 `npm run build`를 실행한다.

## 코딩 스타일과 이름 규칙

TypeScript strict 모드를 유지하고 2칸 들여쓰기를 사용한다. 컴포넌트는 PascalCase로 내보내고 파일명은 기존 패턴처럼 kebab-case를 사용한다(예: `theme-switcher.tsx`). 함수와 변수는 camelCase, 환경 변수는 UPPER_SNAKE_CASE로 작성한다. 내부 모듈은 가능하면 `@/` 별칭으로 가져온다. 서버 전용 로직과 클라이언트 컴포넌트의 경계를 명확히 유지하고, 기존 ESLint·Tailwind·shadcn/ui 패턴을 따른다.

## 테스트 지침

Vitest와 `npm test` 스크립트가 구성되어 있다. 기능 변경에는 가능한 가장 가까운 단위 또는 통합 테스트를 함께 추가하고, 테스트 파일은 `*.test.ts` 또는 `*.test.tsx`로 명명한다. 변경 전에는 `npm test`, lint, production build를 실행하고, 인증·보호 경로의 수동 확인 결과를 PR에 기록한다.

## 커밋과 Pull Request

Git 이력과 기존 `feat:`, `fix:`, `docs:`, `test:`, `chore:` 형식의 짧은 커밋 제목을 따른다. PR에는 변경 목적, 주요 파일, 검증 명령과 결과, 관련 이슈를 적는다. UI 변경에는 전후 스크린샷을 첨부하고, 데이터 계약이나 환경 변수 변경은 마이그레이션·배포 영향을 명시한다.

## 보안과 설정

비밀정보는 `.env.local` 또는 배포 환경에만 저장하고 커밋하지 않는다. 브라우저에는 `NEXT_PUBLIC_SUPABASE_URL`과 publishable key만 노출한다. 서비스 역할 키와 Kiwoom/KRX 자격 증명은 서버 또는 예약 작업에서만 사용하며 로그와 문서 예제에서는 값을 가린다.

## ETF 신호 MVP 작업 연속성

- 정본 문서: `docs/plans/ETF-signal-MVP-plan-v2.2.md`, `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md`, `docs/plans/ETF-signal-MVP-v2.2-상세-개발-실행방안.md`
- 현재 현황·재개 기준: `docs/plans/implementation/`, `docs/guides/etf-signal-mvp-e2e-configuration-guide.md`, `docs/guides/etf-signal-mvp-m6-observation-runbook.md`, `docs/guides/etf-signal-mvp-continuity-harness.md`, `docs/jobs/2026-09-22-etf-signal-mvp-kr-누락일-보충-작업기록.md`
- 2026-09-22 기준 M0–M4·R1과 M5-B 미국 P1 기본 E2E를 완료했다. KR·US 저장 완료 경계는 코드·테스트로 보완했고, US 보고는 유형별 상위 10건이며 실제 데이터 발송 없는 dry-run 결과 1건이다. 첫 KR timer 경로 실행, KR·US 실패 복구·US 휴장 중복 실측, 새 US 형식의 staging 실발송은 미검증이다. 회사 PC는 근무시간에만 운영 가능하지만 설치된 timer는 KR 19:15·US 07:30으로, 정시 실행이 보장되지 않는다. 다음 기동 따라잡기와 정시 실행을 구분해 기록한다.
- 같은 날 KR 누락일 보충 코드와 KR 09:30 timer 원본을 구현했다. US 무손실 필수 요구는 철회했다. 운영 KR timer·독립 dispatch 스크립트 설치본은 아직 19:15 방식이며 첫 자동 E2E 전이다. 보충은 과거 KRX 일별 데이터·신호만 대상으로 하며 과거 Kiwoom·Telegram은 복원하지 않는다.
- Node `22.23.2`를 `.nvmrc`로 고정한다. `npm run build`는 공식 Webpack 경로를 사용한다. 2026-09-22 KR 보충 변경의 전체 검증은 `npm test`(29 파일·90 테스트), `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과다.
- Linear 프로젝트·이슈는 실행 상태 추적용이며, 설계·코드의 정본은 위 저장소 문서와 Git이다. 비밀값·토큰·DB 비밀번호를 어떤 기록에도 남기지 않는다.
- 세션 시작·종료 시에는 `npm run continuity:check`와 연속성 하네스의 작업 기록→정본 문서→Linear→OpenViking 순서를 따른다.
- 2026-09-22 Linear 상태: KOR-55 Done, KOR-56 Todo, KOR-57 In Progress(실발송 대기), KOR-58 Todo(관측 0/20), KOR-59 In Progress(실패 복구 E2E 대기). 첫 KR timer 경로 실행은 아직 미검증이다.
- 기본 개발 실행 루프는 **TDD → 구현 → 포맷 → 대상/전체 테스트 → lint/build → 리뷰 → 문서·Linear·OpenViking 메모리 → 원자적 커밋·푸시**다. 안전하고 되돌릴 수 있는 작업은 이 순서로 중단 없이 계속한다. 운영 데이터·보안·권한·비가역 외부 부작용·요구사항 분기·반복 실패처럼 중요한 이슈에서만 멈추고, 증거·영향·대안을 보고해 승인받는다. 상세 기준은 `docs/guides/etf-signal-mvp-continuity-harness.md`의 “기본 개발 실행 루프와 중단 기준”을 따른다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
