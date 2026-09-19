"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { PaginationMeta } from "@/types/api";
import { cn } from "@/lib/utils";
import { Select } from "./select";

type PaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizes?: number[];
};

function pageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ meta, onPageChange, onLimitChange, pageSizes = [10, 20, 50] }: PaginationProps) {
  const { page, limit, total } = meta;
  const totalPages = Math.max(1, meta.totalPages);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const navBtn = "flex size-8 cursor-pointer items-center justify-center rounded-md border border-line-bright bg-panel text-ink-dim shadow-sm transition-colors hover:bg-panel-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination">
      <div className="flex items-center gap-3 text-sm text-ink-mute">
        <span className="tabular text-sm">
          <span className="text-ink">{from}</span>–<span className="text-ink">{to}</span> of{" "}
          <span className="text-ink">{total}</span>
        </span>
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm sm:inline">Rows per page</span>
            <Select
              aria-label="Rows per page"
              className="h-8 w-20 py-0 text-xs"
              value={String(limit)}
              onValueChange={(v) => v && onLimitChange(Number(v))}
              options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button className={navBtn} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page">
          <ChevronsLeft className="size-4" />
        </button>
        <button className={navBtn} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-ink-mute">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                navBtn,
                "tabular hidden w-auto min-w-8 px-2 text-sm sm:flex",
                p === page && "border-cyan bg-cyan/10 font-medium text-cyan hover:bg-cyan/10 hover:text-cyan",
              )}
            >
              {p}
            </button>
          ),
        )}
        <span className="tabular px-2 text-sm text-ink-dim sm:hidden">
          {page}/{totalPages}
        </span>
        <button className={navBtn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
        <button className={navBtn} onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label="Last page">
          <ChevronsRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
