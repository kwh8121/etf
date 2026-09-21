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

현재 작업 사본에는 Git 이력이 없어 기존 관례를 확인할 수 없다. 커밋은 `feat:`, `fix:`, `docs:`, `test:`, `chore:` 형식의 짧은 명령형 제목을 사용한다. PR에는 변경 목적, 주요 파일, 검증 명령과 결과, 관련 이슈를 적는다. UI 변경에는 전후 스크린샷을 첨부하고, 데이터 계약이나 환경 변수 변경은 마이그레이션·배포 영향을 명시한다.

## 보안과 설정

비밀정보는 `.env.local` 또는 배포 환경에만 저장하고 커밋하지 않는다. 브라우저에는 `NEXT_PUBLIC_SUPABASE_URL`과 publishable key만 노출한다. 서비스 역할 키와 Kiwoom/KRX 자격 증명은 서버 또는 예약 작업에서만 사용하며 로그와 문서 예제에서는 값을 가린다.

## ETF 신호 MVP 작업 연속성

- 정본 문서: `docs/plans/ETF-signal-MVP-plan-v2.2.md`, `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md`, `docs/plans/ETF-signal-MVP-v2.2-상세-개발-실행방안.md`
- 현재 현황·재개 기준: `docs/plans/implementation/`, `docs/guides/etf-signal-mvp-e2e-configuration-guide.md`, `docs/guides/etf-signal-mvp-continuity-harness.md`, `docs/jobs/2026-09-18-etf-signal-mvp-m0-m1-작업기록.md`
- 2026-09-21 기준 M0–M3와 M4의 예약 실행·인증 대시보드 구현은 완료했다. 다음 정확한 작업은 staging `TELEGRAM_BOT_TOKEN`·`TELEGRAM_CHAT_ID` 설정 후 `npm run report:kr-signals -- --send` 실발송 E2E, GitHub production Environment Secret 등록·`workflow_dispatch`, 인증/비인증 `/protected` RLS E2E를 수행하고 `KOR-52`·`KOR-53`을 마감하는 것이다.
- Node `22.23.2`를 `.nvmrc`로 고정한다. `npm run build`는 공식 Webpack 경로를 사용하며, `npm test`(45개), `npx tsc --noEmit`, `npm run lint`, `npm run build`가 이 환경에서 통과했다.
- Linear 프로젝트·이슈는 실행 상태 추적용이며, 설계·코드의 정본은 위 저장소 문서와 Git이다. 비밀값·토큰·DB 비밀번호를 어떤 기록에도 남기지 않는다.
- 세션 시작·종료 시에는 `npm run continuity:check`와 연속성 하네스의 작업 기록→정본 문서→Linear→OpenViking 순서를 따른다.
