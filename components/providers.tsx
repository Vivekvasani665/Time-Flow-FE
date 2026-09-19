"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { isApiError } from "@/lib/api/client";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry client errors (401/403/404/422…) — only transient failures.
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="bottom-right"
        // sonner reads prefers-color-scheme directly and cannot see our
        // data-theme, so pin it and let the token classNames below do the work.
        theme="light"
        toastOptions={{
          classNames: {
            toast:
              "!bg-panel !border !border-line !text-ink !rounded-lg !font-sans !shadow-[var(--shadow-overlay)]",
            title: "!text-sm !font-semibold",
            description: "!text-ink-dim !text-sm",
            success: "[&_[data-icon]]:!text-lime",
            error: "[&_[data-icon]]:!text-danger",
          },
        }}
      />
    </QueryClientProvider>
  );
}
