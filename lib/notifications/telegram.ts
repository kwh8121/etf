const TELEGRAM_MAX_MESSAGE_LENGTH = 4_096;

export interface TelegramReportSection {
  title: string;
  lines: readonly string[];
}

export interface TelegramReportInput {
  market: "KR";
  basDd: string;
  status: "COMPLETED" | "PENDING" | "PARTIAL" | "FAILED" | "SKIPPED";
  runId: string;
  source: string;
  sections: readonly TelegramReportSection[];
}

export function formatTelegramReport(
  input: TelegramReportInput,
  maxLength = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  if (maxLength < 100 || maxLength > TELEGRAM_MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Telegram message length must be between 100 and ${TELEGRAM_MAX_MESSAGE_LENGTH}`,
    );
  }
  const header = `[ETF 신호][${input.market}][${input.status}] ${input.basDd}\n원천: ${input.source}\n실행: ${input.runId}`;
  const disclaimer = "자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.";
  const blocks = input.sections.flatMap((section) =>
    section.lines.length
      ? [`${section.title}\n${section.lines.join("\n")}`]
      : [],
  );
  return splitTelegramText(header, [...blocks, disclaimer], maxLength);
}

export async function sendTelegramMessages(input: {
  token: string;
  chatId: string;
  messages: readonly string[];
  fetchFn?: typeof fetch;
}): Promise<void> {
  const fetchFn = input.fetchFn ?? fetch;
  for (const text of input.messages) {
    const response = await fetchFn(
      `https://api.telegram.org/bot${input.token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chatId,
          text,
          disable_web_page_preview: true,
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        `Telegram sendMessage failed with HTTP ${response.status}`,
      );
  }
}

function splitTelegramText(
  header: string,
  blocks: readonly string[],
  maxLength: number,
): string[] {
  const messages: string[] = [];
  let current = header;
  for (const block of blocks) {
    const next = `${current}\n\n${block}`;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }
    messages.push(current);
    current = header;
    for (const line of block.split("\n")) {
      const candidate = `${current}\n${line}`;
      if (candidate.length <= maxLength) {
        current = candidate;
        continue;
      }
      messages.push(current);
      current = `${header}\n${line}`;
    }
  }
  messages.push(current);
  return messages;
}
