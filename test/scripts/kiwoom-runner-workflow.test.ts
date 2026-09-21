import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Kiwoom은 등록된 IP에서만 토큰을 발급한다. GitHub 호스팅 러너는 IP가 매번 바뀌므로
// Kiwoom을 호출하는 workflow는 등록 IP의 self-hosted runner(label: kiwoom)에서만 실행한다.
const KIWOOM_WORKFLOWS = [
  ".github/workflows/kr-daily.yml",
  ".github/workflows/us-etf-movers.yml",
];

describe("Kiwoom workflows", () => {
  it.each(KIWOOM_WORKFLOWS)(
    "%s runs only on the registered-IP self-hosted runner",
    (path) => {
      const workflow = readFileSync(path, "utf8");
      expect(workflow).toContain("runs-on: [self-hosted, linux, x64, kiwoom]");
      expect(workflow).not.toContain("ubuntu-latest");
      // 한국→Telegram 왕복이 node 기본 연결 시도 제한(250ms)을 넘는다.
      expect(workflow).toContain(
        "NODE_OPTIONS: --network-family-autoselection-attempt-timeout=2000",
      );
      // self-hosted에서 cache: npm은 사용자 계정 전체의 ~/.npm을 GitHub 캐시로 다룬다.
      // npm 캐시는 runner 디스크에 이미 유지되므로 쓰지 않는다.
      expect(workflow).not.toContain("cache: npm");
    },
  );
});
