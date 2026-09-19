import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, buildQuery, resetSessionTracking, setSessionExpiredHandler } from "@/lib/api/client";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function withExpiry(res: Response, expiresAt: number) {
  res.headers.set("X-Session-Expires-At", new Date(expiresAt).toISOString());
  return res;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetSessionTracking();
});

describe("api client", () => {
  it("builds query strings without empty values", () => {
    expect(buildQuery({ page: 2, search: "", status: undefined, sortOrder: "asc" })).toBe("?page=2&sortOrder=asc");
    expect(buildQuery({})).toBe("");
  });

  it("unwraps list envelopes into items + meta", async () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { success: true, data: [{ id: "a" }], meta })));
    await expect(api.list("/users")).resolves.toEqual({ items: [{ id: "a" }], meta });
  });

  it("throws a typed ApiError from the error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json(409, { success: false, code: "USER_EMAIL_EXISTS", message: "Email already exists" })),
    );
    const error = await api.post("/users", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "USER_EMAIL_EXISTS", message: "Email already exists" });
  });

  it("refreshes once on 401 and retries the original request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { success: false, code: "UNAUTHENTICATED", message: "expired" }))
      .mockResolvedValueOnce(json(200, { success: true, data: { user: {} } }))
      .mockResolvedValueOnce(json(200, { success: true, data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/auth/me")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/refresh");
  });

  it("signals session expiry when refresh fails", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(401, { success: false, code: "UNAUTHENTICATED", message: "expired" }))
        .mockResolvedValueOnce(json(401, { success: false, code: "UNAUTHENTICATED", message: "no refresh" })),
    );

    await expect(api.get("/dashboard")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("refreshes before the access token lapses instead of waiting for a 401", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(withExpiry(json(200, { success: true, data: { id: "me" } }), now + 15 * 60_000))
      .mockResolvedValueOnce(withExpiry(json(200, { success: true, data: { user: {} } }), now + 30 * 60_000))
      .mockResolvedValueOnce(json(200, { success: true, data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/auth/me");
    // Timer fires one minute before expiry and rotates the session silently.
    await vi.advanceTimersByTimeAsync(14 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/refresh");

    await api.get("/notifications");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/notifications");
  });

  it("refreshes before sending when the timer was throttled past expiry", async () => {
    const now = Date.now();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(withExpiry(json(200, { success: true, data: { id: "me" } }), now + 30_000))
      .mockResolvedValueOnce(withExpiry(json(200, { success: true, data: { user: {} } }), now + 15 * 60_000))
      .mockResolvedValueOnce(json(200, { success: true, data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/auth/me"); // expiry is already inside the refresh lead window
    await expect(api.get("/dashboard")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/auth/me", "/api/auth/refresh", "/api/dashboard"]);
  });
});
