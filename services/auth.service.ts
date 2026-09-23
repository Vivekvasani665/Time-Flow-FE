import { api, request, resetSessionTracking } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

export type LoginInput = { email: string; password: string };
export type RegisterInput = { firstName: string; lastName: string; email: string; password: string };

/** A correct password on an account with an authenticator app earns this instead of a session. */
export type TwoFactorChallenge = {
  twoFactorRequired: true;
  challengeToken: string;
  challengeExpiresAt: string;
};

export type LoginResult = { signedIn: true; user: AuthUser } | TwoFactorChallenge;

export const authService = {
  /**
   * Resolves to whichever step the API asked for. Callers must branch on it —
   * treating every 200 as "signed in" navigates away with no session cookie and
   * bounces straight back off the auth gate in middleware.
   */
  login: async (input: LoginInput): Promise<LoginResult> => {
    const { data } = await request<{ user: AuthUser } | TwoFactorChallenge>("/auth/login", {
      method: "POST",
      body: input,
      skipAuthRefresh: true,
    });
    if ("twoFactorRequired" in data && data.twoFactorRequired) return data;
    return { signedIn: true, user: (data as { user: AuthUser }).user };
  },

  register: async (input: RegisterInput) =>
    (await request<{ user: AuthUser }>("/auth/register", { method: "POST", body: input, skipAuthRefresh: true })).data.user,
  logout: async () => {
    try {
      await request<null>("/auth/logout", { method: "POST", skipAuthRefresh: true });
    } finally {
      resetSessionTracking();
    }
  },
  me: () => api.get<AuthUser>("/auth/me"),
};
