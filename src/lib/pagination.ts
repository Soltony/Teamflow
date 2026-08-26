/**
 * Page arithmetic, in one place.
 *
 * Every list in this application used to load its whole table and let the
 * browser show a slice of it. Paging them one at a time invites four slightly
 * different implementations, so the clamping and bounding live here.
 */

export interface PageRequest {
  /** 1-based. Out-of-range values are clamped, not rejected. */
  page?: number | null;
  pageSize?: number | null;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  skip: number;
  totalCount: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 9;

/**
 * Bounded so a crafted request cannot ask for the entire table by passing a
 * huge page size — the point of paging is that the server decides how much it
 * is willing to send.
 */
export const MAX_PAGE_SIZE = 100;

export function resolvePageSize(requested: number | null | undefined, fallback = DEFAULT_PAGE_SIZE): number {
  const value = Number(requested);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.trunc(value), MAX_PAGE_SIZE);
}

/**
 * Works out which slice to fetch, given how many rows there are.
 *
 * The page is clamped to the last one that exists, so deleting the final row
 * on page 5 leaves the user looking at page 4 rather than an empty list.
 */
export function resolvePage(
  request: PageRequest,
  totalCount: number,
  fallbackPageSize = DEFAULT_PAGE_SIZE,
): PageInfo {
  const pageSize = resolvePageSize(request.pageSize, fallbackPageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const requestedPage = Number(request.page);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages)
    : 1;

  return { page, pageSize, skip: (page - 1) * pageSize, totalCount, totalPages };
}

/** The envelope every paged action returns alongside its rows. */
export interface Paged<T> extends Omit<PageInfo, 'skip'> {
  items: T[];
}
