import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, describeError, getUserFriendlyError, resetSessionTracking } from "@/lib/api/client";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetSessionTracking();
});

describe("getUserFriendlyError", () => {
  it.each([
    [400, "Invalid Request", "We couldn’t process your request. Please check your information and try again.", false],
    [403, "Access Denied", "You don’t have permission to perform this action.", false],
    [404, "Not Found", "We couldn’t find what you’re looking for. It may have been moved or removed.", false],
    [405, "Action Not Available", "This action isn’t available right now. Please try again.", false],
    [409, "Conflict", "This action conflicts with existing information. Please review your details and try again.", false],
    [422, "Check Your Information", "Some of the information you entered isn’t valid. Please check your details and try again.", false],
    [429, "Too Many Requests", "You’ve made too many requests. Please wait a moment and try again.", false],
    [500, "Something Went Wrong", "Something went wrong on our end. Please try again shortly.", true],
    [502, "Connection Problem", "We’re having trouble connecting to the server. Please try again in a moment.", true],
    [503, "Service Temporarily Unavailable", "The service is temporarily unavailable. Please try again shortly.", true],
    [504, "Request Timed Out", "The request is taking longer than expected. Please try again.", true],
  ])("%i → %s", (status, title, message, canRetry) => {
    expect(getUserFriendlyError(status)).toMatchObject({ title, message, canRetry });
  });

  it("distinguishes an expired session from a visitor who never signed in", () => {
    expect(getUserFriendlyError(401, { code: "UNAUTHENTICATED", message: "Session is no longer valid" })).toMatchObject({
      title: "Session Expired",
      message: "Your session has expired. Please sign in again to continue.",
    });
    expect(getUserFriendlyError(401, { code: "UNAUTHENTICATED", message: "Authentication required" }).message).toBe("Please sign in to continue.");
  });

  it("keeps messages the API wrote for users on client errors", () => {
    expect(getUserFriendlyError(401, { code: "INVALID_CREDENTIALS", message: "Invalid email or password" }).message).toBe("Invalid email or password");
    expect(getUserFriendlyError(409, { code: "USER_EMAIL_EXISTS", message: "A user with this email already exists" })).toMatchObject({
      title: "Conflict",
      message: "A user with this email already exists",
    });
    expect(getUserFriendlyError(410, { code: "INVITATION_LINK_INVALID", message: "Invitation Link Expired or Already Used" }).message).toBe(
      "Invitation Link Expired or Already Used",
    );
  });

  it("never shows server text on a 5xx, however it is worded", () => {
    const friendly = getUserFriendlyError(500, { code: "INTERNAL_ERROR", message: "Invalid `tx.userInvitation.updateMany()` invocation" });
    expect(friendly.message).toBe("Something went wrong on our end. Please try again shortly.");
  });

  it("hides technical text even on a 4xx", () => {
    for (const message of ["PrismaClientKnownRequestError: P2002", "Cannot read properties of undefined", "at handler (/app/src/x.ts:12:5)", "Route POST /api/x not found"]) {
      const friendly = getUserFriendlyError(message.startsWith("Route") ? 404 : 400, { code: message.startsWith("Route") ? "ROUTE_NOT_FOUND" : "BAD_REQUEST", message });
      expect(friendly.message).not.toContain(message);
    }
  });

  it("uses the validation copy for VALIDATION_ERROR regardless of 400 or 422", () => {
    expect(getUserFriendlyError(400, { code: "VALIDATION_ERROR", message: "Validation failed" }).title).toBe("Check Your Information");
  });

  it("treats a missing status as a network failure", () => {
    expect(getUserFriendlyError(0)).toMatchObject({ title: "Connection Problem", canRetry: true, kind: "network" });
  });
});

describe("describeError", () => {
  it("gives unknown errors a safe message instead of their own text", () => {
    expect(describeError(new Error("x is not a function"))).toEqual({
      kind: "unknown",
      title: "Something Went Wrong",
      message: "We couldn’t complete your request. Please try again in a moment.",
      canRetry: true,
    });
    expect(describeError("boom").message).not.toContain("boom");
  });
});

describe("api client errors", () => {
  it("exposes the friendly message and keeps the server's on serverMessage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(500, { success: false, code: "INTERNAL_ERROR", message: "db down", debug: "/Users/x/y.ts" })));
    const error = (await api.post("/admin/invitations", {}).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Something went wrong on our end. Please try again shortly.");
    expect(error.serverMessage).toBe("db down");
    expect(error.friendly.canRetry).toBe(true);
  });

  it("handles a gateway page that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 })));
    const error = (await api.get("/dashboard").catch((e: unknown) => e)) as ApiError;
    expect(error.friendly.title).toBe("Connection Problem");
  });

  it("maps a failed fetch to the connection message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = (await api.get("/dashboard").catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect(error.message).toBe("We’re having trouble connecting to the server. Please check your connection and try again.");
  });
});
