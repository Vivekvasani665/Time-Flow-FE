import { api, request, resetSessionTracking } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

export type LoginInput = { email: string; password: string };
export type RegisterInput = { firstName: string; lastName: string; email: string; password: string };

/** Password was right but the account has 2FA: no session yet, finish via `loginTwoFactor`. */
export type TwoFactorChallenge = { challengeToken: string; challengeExpiresAt: string };

export type LoginResult = { twoFactorRequired: false; user: AuthUser } | ({ twoFactorRequired: true } & TwoFactorChallenge);

export type TwoFactorLoginResult = { user: AuthUser; recoveryCodesRemaining?: number };

export const authService = {
  login: async (input: LoginInput) =>
    (await request<LoginResult>("/auth/login", { method: "POST", body: input, skipAuthRefresh: true })).data,
  loginTwoFactor: async (challengeToken: string, code: string) =>
    (await request<TwoFactorLoginResult>("/auth/login/2fa", { method: "POST", body: { challengeToken, code }, skipAuthRefresh: true })).data,
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
