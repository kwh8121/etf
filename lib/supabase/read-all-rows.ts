const DEFAULT_PAGE_SIZE = 1_000;

export interface ReadAllRowsOrder {
  column: string;
  ascending?: boolean;
}

export interface ReadAllRowsResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
}

export interface ReadAllRowsQuery<T>
  extends PromiseLike<ReadAllRowsResponse<T>> {
  order(column: string, options?: { ascending?: boolean }): this;
  range(start: number, end: number): this;
}

export interface ReadAllRowsInput<T, TQuery extends ReadAllRowsQuery<T>> {
  operation: string;
  createQuery: () => TQuery;
  orderBy: readonly [ReadAllRowsOrder, ...ReadAllRowsOrder[]];
  getKey: (row: T) => string;
  pageSize?: number;
  onPage?: (query: TQuery) => void;
}

export async function readAllRows<
  T,
  TQuery extends ReadAllRowsQuery<T> = ReadAllRowsQuery<T>,
>(input: ReadAllRowsInput<T, TQuery>): Promise<T[]> {
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`Supabase ${input.operation} page size must be positive`);
  }

  const rows: T[] = [];
  const seenKeys = new Set<string>();
  let expectedCount: number | null = null;

  while (expectedCount === null || rows.length < expectedCount) {
    const pageStart = rows.length;
    const pageEnd = pageStart + pageSize - 1;
    let query = input.createQuery();
    for (const order of input.orderBy) {
      query = query.order(order.column, {
        ascending: order.ascending ?? true,
      });
    }
    query = query.range(pageStart, pageEnd);
    input.onPage?.(query);

    const { data, error, count } = await query;
    if (error) {
      throw new Error(`Supabase ${input.operation} failed: ${error.message}`);
    }
    if (count === null) {
      throw new Error(`Supabase ${input.operation} returned no exact count`);
    }
    if (expectedCount !== null && count !== expectedCount) {
      throw new Error(
        `Supabase ${input.operation} changed exact count from ${expectedCount} to ${count}`,
      );
    }
    expectedCount = count;

    const pageRows = data ?? [];
    for (const row of pageRows) {
      const key = input.getKey(row);
      if (seenKeys.has(key)) {
        throw new Error(
          `Supabase ${input.operation} returned duplicate key ${key}`,
        );
      }
      seenKeys.add(key);
      rows.push(row);
    }

    if (rows.length === expectedCount) {
      return rows;
    }
    if (pageRows.length === 0 || pageRows.length < pageSize) {
      throw new Error(
        `Supabase ${input.operation} stopped before fetching all rows: fetched ${rows.length} of ${expectedCount}`,
      );
    }
    if (rows.length > expectedCount) {
      throw new Error(
        `Supabase ${input.operation} fetched more rows than exact count: fetched ${rows.length} of ${expectedCount}`,
      );
    }
  }

  return rows;
}
