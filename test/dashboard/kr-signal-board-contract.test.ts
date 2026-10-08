import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const board = readFileSync("components/kr-signal-board.tsx", "utf8");

describe("방향 대비 보드 계약", () => {
  it("클라이언트 컴포넌트로 선언된다", () => {
    expect(board.startsWith('"use client"')).toBe(true);
  });

  it("기간과 스크린 세그먼트를 모두 제공한다", () => {
    for (const label of ["일간", "5거래일", "전체", "유동성"]) {
      expect(board).toContain(label);
    }
  });

  it("색만으로 방향을 구분하지 않고 기호와 이름을 함께 쓴다", () => {
    expect(board).toContain("▲");
    expect(board).toContain("▼");
    expect(board).toContain("상승");
    expect(board).toContain("하락");
  });

  it("방향별 색 토큰을 적용한다", () => {
    expect(board).toContain("text-signal-gain");
    expect(board).toContain("text-signal-loss");
  });

  it("숫자를 고정폭으로 정렬하고 모바일에서 2열로 쌓는다", () => {
    expect(board).toContain("tabular-nums");
    expect(board).toContain("md:grid-cols-2");
  });

  it("해당 조건의 행이 없을 때를 처리한다", () => {
    expect(board).toContain("해당 조건의 신호가 없습니다.");
  });
});
