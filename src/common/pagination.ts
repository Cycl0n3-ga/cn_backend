export type Pagination = {
  page: number;
  limit: number;
};

export function parsePagination(
  page?: string,
  limit?: string,
  defaultLimit = 20,
  maxLimit = 100,
): Pagination {
  const parsedPage = Math.max(1, Number.parseInt(page || '1', 10) || 1);
  const parsedLimit = Math.min(
    maxLimit,
    Math.max(
      1,
      Number.parseInt(limit || String(defaultLimit), 10) || defaultLimit,
    ),
  );

  return { page: parsedPage, limit: parsedLimit };
}
