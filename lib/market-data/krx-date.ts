const KRX_REQUEST_DATE_PATTERN = /^\d{8}$/;

export class InvalidKrxRequestDateError extends Error {
  constructor(value: string) {
    super(`Invalid KRX request date: ${value}`);
    this.name = "InvalidKrxRequestDateError";
  }
}

export function assertValidKrxRequestDate(value: string): void {
  if (!KRX_REQUEST_DATE_PATTERN.test(value)) {
    throw new InvalidKrxRequestDateError(value);
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new InvalidKrxRequestDateError(value);
  }
}
