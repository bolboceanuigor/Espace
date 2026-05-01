export type PaginationQuery = {
  page?: number;
  limit?: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function resolvePagination(query: PaginationQuery, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit || defaultLimit)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
