import { api, request, resetSessionTracking } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

export type LoginInput = { email: string; password: string };
export type RegisterInput = { firstName: string; lastName: string; email: string; password: string };

/** Password was right but the account has 2FA: no session yet, finish via `loginTwoFactor`. */
export type TwoFactorChallenge = { challengeToken: string; challengeExpiresAt: string };

/**
 * Password was right and LOGIN_OTP_ENABLED is on: a code was emailed, and no
 * session exists until `verifyLoginOtp` succeeds. The code itself never reaches the client.
 */
export type LoginOtpChallenge = {
  verificationId: string;
  /** Masked address the code was sent to, e.g. `v****@gmail.com`. */
  email: string;
  /** Relative, so a wrong device clock cannot skew the countdown. */
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

export type LoginResult =
  | { twoFactorRequired: false; requiresOtp?: false; user: AuthUser }
  | ({ twoFactorRequired: true; requiresOtp?: false } & TwoFactorChallenge)
  | ({ requiresOtp: true; twoFactorRequired?: false } & LoginOtpChallenge);

export type TwoFactorLoginResult = { user: AuthUser; recoveryCodesRemaining?: number };

export const authService = {
  login: async (input: LoginInput) =>
    (await request<LoginResult>("/auth/login", { method: "POST", body: input, skipAuthRefresh: true })).data,
  loginTwoFactor: async (challengeToken: string, code: string) =>
    (await request<TwoFactorLoginResult>("/auth/login/2fa", { method: "POST", body: { challengeToken, code }, skipAuthRefresh: true })).data,
  verifyLoginOtp: async (verificationId: string, otp: string) =>
    (await request<{ user: AuthUser }>("/auth/verify-login-otp", { method: "POST", body: { verificationId, otp }, skipAuthRefresh: true })).data.user,
  resendLoginOtp: async (verificationId: string) =>
    (await request<LoginOtpChallenge>("/auth/resend-login-otp", { method: "POST", body: { verificationId }, skipAuthRefresh: true })).data,
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
