"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { SortOrder } from "@/types/api";

export type TableParams<F extends string> = {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: SortOrder;
  filters: Partial<Record<F, string>>;
};

/**
 * Table state (page, size, search, sort, filters) lives in the URL so views are
 * shareable, survive reloads and work with back/forward.
 */
export function useTableParams<F extends string>(filterKeys: readonly F[], defaults: { sortBy?: string; limit?: number } = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo<TableParams<F>>(() => {
    const filters: Partial<Record<F, string>> = {};
    for (const key of filterKeys) {
      const v = searchParams.get(key);
      if (v) filters[key] = v;
    }
    const order = searchParams.get("sortOrder");
    return {
      page: Math.max(1, Number(searchParams.get("page")) || 1),
      limit: Math.min(100, Math.max(1, Number(searchParams.get("limit")) || defaults.limit || 10)),
      search: searchParams.get("search") ?? "",
      sortBy: searchParams.get("sortBy") ?? defaults.sortBy ?? "createdAt",
      sortOrder: order === "asc" ? "asc" : "desc",
      filters,
    };
    // filterKeys is a static tuple per table
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, defaults.sortBy, defaults.limit]);

  const update = useCallback(
    (patch: Record<string, string | number | undefined>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const toggleSort = useCallback(
    (column: string) => {
      const sortOrder = params.sortBy === column && params.sortOrder === "desc" ? "asc" : "desc";
      update({ sortBy: column, sortOrder });
    },
    [params.sortBy, params.sortOrder, update],
  );

  const apiParams = useMemo(
    () => ({
      page: params.page,
      limit: params.limit,
      search: params.search || undefined,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      ...params.filters,
    }),
    [params],
  );

  return { params, apiParams, update, toggleSort };
}
