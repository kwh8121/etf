const serverSecretEnvKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "KIWOOM_APP_KEY",
  "KIWOOM_SECRET_KEY",
  "KRX_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
] as const;

export type ServerSecretEnvKey = (typeof serverSecretEnvKeys)[number];
type Environment = Readonly<Record<string, string | undefined>>;

export function getRequiredServerSecret(
  key: ServerSecretEnvKey,
  env: Environment = process.env,
): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${key}`);
  }

  return value;
}

export function maskSecret(value: string): string {
  if (value.length <= 4) {
    return "****";
  }

  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export { serverSecretEnvKeys };
