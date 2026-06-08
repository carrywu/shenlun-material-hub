export function parsePositiveIntParam(
  value: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: { defaultPage?: number; defaultPageSize?: number; maxPageSize?: number } = {}
) {
  const page = parsePositiveIntParam(searchParams.get("page"), options.defaultPage ?? 1);
  const pageSize = parsePositiveIntParam(
    searchParams.get("pageSize"),
    options.defaultPageSize ?? 20,
    options.maxPageSize ?? 100
  );
  return { page, pageSize };
}
