"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";

type TableToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
};

export function TableToolbar({ search, onSearch, placeholder = "Search…", filters, actions }: TableToolbarProps) {
  const [value, setValue] = useState(search);
  const debounced = useDebounce(value);

  useEffect(() => {
    if (debounced !== search) onSearch(debounced);
    // only react to user typing, not to URL → state sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // External URL changes (back/forward, "clear filters") flow back into the input,
  // without clobbering what the user is currently typing.
  useEffect(() => {
    if (search !== debounced) setValue(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative w-full lg:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded p-1 text-ink-mute hover:bg-panel-3 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {filters && <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">{filters}</div>}
      {actions && <div className="flex items-center gap-2 lg:ml-auto">{actions}</div>}
    </div>
  );
}
