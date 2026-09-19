import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Keep failed-query errors cheap: findBy*/waitFor retries otherwise pretty-print
// the whole DOM on every attempt.
configure({
  getElementError: (message) => {
    const error = new Error(message ?? "Element not found");
    error.name = "TestingLibraryElementError";
    return error;
  },
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  navigation.searchParams = new URLSearchParams();
  navigation.pathname = "/";
});

// ── next/navigation ─────────────────────────────────────────
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  forward: vi.fn(),
};

/**
 * Mutable stand-in for the URL. Views keep their table state (page, filters,
 * selection) in the query string, so a test drives them by setting this.
 */
const navigation = vi.hoisted(() => ({ searchParams: new URLSearchParams(), pathname: "/" }));

/** Point the mocked router at a query string, e.g. `setSearchParams({ selected: id })`. */
export function setSearchParams(params: Record<string, string> = {}) {
  navigation.searchParams = new URLSearchParams(params);
}

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
  redirect: vi.fn(),
}));

// ── DOM gaps used by Radix primitives ─────────────────────
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}
Element.prototype.scrollIntoView ??= () => undefined;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
