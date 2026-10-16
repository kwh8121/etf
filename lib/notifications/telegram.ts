import { escapeTelegramHtml } from "./etf-detail-link.ts";

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
  /** 기준일 웹 열람 링크. 없으면 헤더에 줄을 추가하지 않는다. */
  webUrl?: string;
  /** true일 때 행은 escape된 HTML이다. 헤더·섹션명은 여기서 escape한다. */
  html?: boolean;
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
  const disclosure =
    "5거래일 값은 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아닙니다.";
  const renderText = input.html ? escapeTelegramHtml : (text: string) => text;
  const header = renderText(
    [
      `[ETF 신호][${input.market}][${input.status}] ${input.basDd}`,
      `원천: ${input.source}`,
      `실행: ${input.runId}`,
      disclosure,
      ...(input.webUrl ? [`상세: ${input.webUrl}`] : []),
    ].join("\n"),
  );
  const disclaimer = "자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.";
  const blocks = input.sections.flatMap((section) =>
    section.lines.length
      ? [`${renderText(section.title)}\n${section.lines.join("\n")}`]
      : [],
  );
  return splitTelegramText(header, [...blocks, disclaimer], maxLength, input.html);
}

export function formatExperimentalTelegramReport(
  input: {
    title: string;
    observedAt: string;
    runId: string;
    sections: readonly TelegramReportSection[];
    disclosure: string;
    /** 한국 관측일 웹 열람 링크. 없으면 헤더에 줄을 추가하지 않는다. */
    webUrl?: string;
    /** true일 때 각 행은 escape된 HTML이어야 한다. */
    html?: boolean;
  },
  maxLength = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  const renderText = input.html ? escapeTelegramHtml : (text: string) => text;
  const header = renderText(
    `[ETF 신호][US][P1 실험] ${input.title}\n관측: ${input.observedAt}\n실행: ${input.runId}\n${input.disclosure}${input.webUrl ? `\n상세: ${input.webUrl}` : ""}`,
  );
  const blocks = input.sections.flatMap((section) =>
    section.lines.length
      ? [`${renderText(section.title)}\n${section.lines.join("\n")}`]
      : [],
  );
  return splitTelegramText(
    header,
    [...blocks, "자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다."],
    maxLength,
    input.html,
  );
}

export async function sendTelegramMessages(input: {
  token: string;
  chatId: string;
  messages: readonly string[];
  parseMode?: "HTML";
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
          link_preview_options: { is_disabled: true },
          ...(input.parseMode ? { parse_mode: input.parseMode } : {}),
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
  html = false,
): string[] {
  // HTML 행은 anchor 중간에서 자를 수 없다. 모든 행을 발송 전에 검사한다.
  if (
    html &&
    (header.length > maxLength ||
      blocks.some((block) =>
        block.split("\n").some((line) => header.length + 1 + line.length > maxLength),
      ))
  ) {
    throw new Error(
      "Telegram message header or HTML row exceeds the message limit",
    );
  }
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
