import { api, request, resetSessionTracking } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

export type LoginInput = { email: string; password: string };
export type RegisterInput = { firstName: string; lastName: string; email: string; password: string };

/**
 * A correct password does not always mean a session. With login OTP enabled the
 * API answers 200 with this instead and sets no cookies — the session is issued
 * only once the emailed code comes back.
 */
export type LoginOtpChallenge = {
  requiresOtp: true;
  /** Identifies this pending sign-in; sent back with the code. */
  verificationId: string;
  /** Masked, e.g. `v****@gmail.com` — safe to display. */
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
  /** Relative twins of the dates above, so a client with a skewed clock still counts down correctly. */
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

/** Accounts with an authenticator app take this branch instead of the emailed code. */
export type TwoFactorChallenge = {
  twoFactorRequired: true;
  challengeToken: string;
  challengeExpiresAt: string;
};

export type LoginResult = { signedIn: true; user: AuthUser } | LoginOtpChallenge | TwoFactorChallenge;

/** `/auth/login/otp/resend` returns the same challenge without the discriminator. */
type ResendResponse = Omit<LoginOtpChallenge, "requiresOtp">;

export const authService = {
  /**
   * Resolves to whichever step the API asked for. Callers must branch on it —
   * treating every 200 as "signed in" navigates away with no session cookie and
   * bounces straight back off the auth gate in middleware.
   */
  login: async (input: LoginInput): Promise<LoginResult> => {
    const { data } = await request<{ user: AuthUser } | LoginOtpChallenge | TwoFactorChallenge>("/auth/login", {
      method: "POST",
      body: input,
      skipAuthRefresh: true,
    });
    if ("requiresOtp" in data && data.requiresOtp) return data;
    if ("twoFactorRequired" in data && data.twoFactorRequired) return data;
    return { signedIn: true, user: (data as { user: AuthUser }).user };
  },

  /** Step two: trades the code for a session. Same response shape as a one-step sign-in. */
  verifyLoginOtp: async (input: { verificationId: string; otp: string }) =>
    (await request<{ user: AuthUser }>("/auth/login/otp/verify", { method: "POST", body: input, skipAuthRefresh: true })).data.user,

  /** Sends a new code for the same pending sign-in; the previous code stops working. */
  resendLoginOtp: async (verificationId: string): Promise<LoginOtpChallenge> => {
    const { data } = await request<ResendResponse>("/auth/login/otp/resend", {
      method: "POST",
      body: { verificationId },
      skipAuthRefresh: true,
    });
    return { requiresOtp: true, ...data };
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
