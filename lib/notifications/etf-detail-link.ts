/** Telegram HTML의 텍스트와 속성 값을 escape한다. */
export function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 기존 코드만으로 구성할 수 있는 공개 상세 페이지. 추가 조회는 하지 않는다. */
export function formatEtfDetailLink(
  market: "KR" | "US",
  code: string,
  name: string,
): string {
  const label = escapeTelegramHtml(name.replace(/[\r\n]+/g, " "));
  if (typeof code !== "string") return label;
  const valid =
    market === "KR"
      ? /^[0-9A-Z]{6}$/.test(code)
      : /^[A-Z][A-Z0-9.-]{0,19}$/.test(code);
  if (!valid) return label;
  const url =
    market === "KR"
      ? `https://m.stock.naver.com/domestic/stock/${code}/total`
      : `https://finance.yahoo.com/quote/${encodeURIComponent(code)}/`;
  return `<a href="${escapeTelegramHtml(url)}">${label}</a>`;
}
