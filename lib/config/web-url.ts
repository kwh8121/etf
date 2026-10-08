type Environment = Readonly<Record<string, string | undefined>>;

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * 웹 열람 경로의 base URL. 비밀값이 아니므로 serverSecretEnvKeys에 두지 않는다.
 * 미설정이면 null을 돌려주고 호출부는 링크를 생략한다.
 */
export function resolveWebBaseUrl(env: Environment = process.env): string | null {
  const raw = env.ETF_WEB_BASE_URL?.trim();
  if (!raw) return null;
  const normalized = stripTrailingSlashes(raw);
  return normalized === "" ? null : normalized;
}

export function buildKrSignalUrl(baseUrl: string, basDd: string): string {
  return `${stripTrailingSlashes(baseUrl)}/signals/kr/${basDd}`;
}
