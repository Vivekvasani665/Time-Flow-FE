"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { PaginationMeta, SortOrder } from "@/types/api";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Server-side sort field; column is sortable when set. */
  sortKey?: string;
  className?: string;
  /** Rendered as the card title on small screens. */
  primary?: boolean;
  hideOnMobile?: boolean;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[] | undefined;
  meta?: PaginationMeta;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSort?: (sortKey: string) => void;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  rowActions?: (row: T) => ReactNode;
  rowHref?: (row: T) => string;
  empty: { title: string; description?: string; action?: ReactNode };
  toolbar?: ReactNode;
  caption: string;
};

export function DataTable<T>({
  columns,
  data,
  meta,
  getRowId,
  isLoading,
  isFetching,
  error,
  onRetry,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onLimitChange,
  rowActions,
  rowHref,
  empty,
  toolbar,
  caption,
}: DataTableProps<T>) {
  const router = useRouter();
  const rows = data ?? [];
  const showSkeleton = isLoading && rows.length === 0;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile);

  const body = error && rows.length === 0 ? (
    <ErrorState message={error.message} onRetry={onRetry} />
  ) : !showSkeleton && rows.length === 0 ? (
    <EmptyState {...empty} />
  ) : null;

  return (
    <div className="hud-panel clip-corner">
      {toolbar && <div className="border-b border-line p-4">{toolbar}</div>}

      {/* Thin progress line while refetching in the background. */}
      <div className="relative h-0.5 overflow-hidden" aria-hidden="true">
        {isFetching && !showSkeleton && <div className="absolute inset-0 animate-pulse bg-cyan/40" />}
      </div>

      {body ?? (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b border-line bg-panel-2">
                  {columns.map((col) => {
                    const active = col.sortKey && sortBy === col.sortKey;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
                        className={cn("px-4 py-2.5 text-xs font-medium whitespace-nowrap text-ink-mute", col.className)}
                      >
                        {col.sortKey && onSort ? (
                          <button
                            type="button"
                            onClick={() => onSort(col.sortKey as string)}
                            className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-ink", active && "text-ink")}
                          >
                            {col.header}
                            {active ? (
                              sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-50" />
                            )}
                          </button>
                        ) : (
                          <span>{col.header}</span>
                        )}
                      </th>
                    );
                  })}
                  {rowActions && (
                    <th scope="col" className="w-12 px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {showSkeleton
                  ? Array.from({ length: meta?.limit ?? 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        {columns.map((col) => (
                          <td key={col.key} className="px-4 py-[var(--row-py)]">
                            <Skeleton className="h-4 w-full max-w-40" />
                          </td>
                        ))}
                        {rowActions && <td className="px-4" />}
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr
                        key={getRowId(row)}
                        onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                        className={cn(
                          "border-b border-line transition-colors last:border-0 hover:bg-panel-2",
                          rowHref && "cursor-pointer",
                        )}
                      >
                        {columns.map((col) => (
                          <td key={col.key} className={cn("px-4 py-[var(--row-py)] align-middle text-sm", col.className)}>
                            {col.cell(row)}
                          </td>
                        ))}
                        {rowActions && (
                          <td className="px-4 py-[var(--row-py)] text-right" onClick={(e) => e.stopPropagation()}>
                            {rowActions(row)}
                          </td>
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-line md:hidden" aria-label={caption}>
            {showSkeleton
              ? Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="space-y-2 p-4">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </li>
                ))
              : rows.map((row) => (
                  <li key={getRowId(row)} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn("min-w-0 flex-1", rowHref && "cursor-pointer")}
                        onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                      >
                        {primary && primary.cell(row)}
                      </div>
                      {rowActions && <div>{rowActions(row)}</div>}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {secondary.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <dt className="text-xs text-ink-mute">{col.header}</dt>
                          <dd className="mt-0.5 truncate text-sm">{col.cell(row)}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
          </ul>
        </>
      )}

      {meta && onPageChange && rows.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <Pagination meta={meta} onPageChange={onPageChange} onLimitChange={onLimitChange} />
        </div>
      )}
    </div>
  );
}
