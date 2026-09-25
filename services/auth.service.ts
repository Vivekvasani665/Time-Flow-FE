import { api, request, resetSessionTracking } from "@/lib/api/client";
import type { AuthUser } from "@/types/api";

/** Sign in with the email or the mobile number on the account — the API takes exactly one. */
export type LoginInput = { email: string; password: string } | { phone: string; password: string };
/** `phone` in international form, country code included: `+919876543210`. */
export type RegisterInput = { firstName: string; lastName: string; email: string; phone: string; password: string };

export type OtpChannel = "email" | "sms";

/**
 * Per-channel outcome of the latest send. `code` is safe to show: EMAIL_DELIVERY_FAILED,
 * INVALID_PHONE_NUMBER, SMS_NOT_CONFIGURED, SMS_BLOCKED_IN_DEVELOPMENT, SMS_PROVIDER_AUTH_FAILED,
 * SMS_PROVIDER_UNAVAILABLE or SMS_DELIVERY_FAILED.
 */
export type ChannelDelivery = { status: "sent" } | { status: "failed"; code: string };
export type OtpDelivery = Partial<Record<OtpChannel, ChannelDelivery>>;

/**
 * Signing up creates an unverified account and sends one code to both the email
 * and the mobile number. No session is issued — the account can sign in only
 * after the code is verified.
 */
export type SignupOtpChallenge = {
  verificationId: string;
  /** Masked, e.g. `v****@gmail.com` and `+91******3210` — safe to display. */
  email: string;
  phone: string;
  /** Channels the current code actually reached. */
  channels: OtpChannel[];
  /** Why a channel was not reached, when one was not. Only the channels just sent to are present. */
  delivery: OtpDelivery;
  /** Local deadlines, derived from the API's relative seconds so a skewed clock still counts down correctly. */
  expiresAt: string;
  resendAvailableAt: string;
};

type SignupOtpResponse = Omit<SignupOtpChallenge, "expiresAt" | "resendAvailableAt"> & {
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const toSignupChallenge = ({ verificationId, email, phone, channels, delivery, expiresInSeconds, resendAvailableInSeconds }: SignupOtpResponse): SignupOtpChallenge => ({
  verificationId,
  email,
  phone,
  channels,
  delivery: delivery ?? {},
  expiresAt: inSeconds(expiresInSeconds),
  resendAvailableAt: inSeconds(resendAvailableInSeconds),
});

/**
 * A correct password does not always mean a session. With login OTP enabled the
 * API answers 200 with this instead and sets no cookies — the session is issued
 * only once the code comes back. One code goes to the email and, when the account
 * has a mobile number, the same code by SMS.
 */
export type LoginOtpChallenge = {
  requiresOtp: true;
  /** Identifies this pending sign-in; sent back with the code. */
  verificationId: string;
  /** Masked, e.g. `v****@gmail.com` — safe to display. */
  email: string;
  /** Masked, e.g. `+91******3210`. Null when the account has no mobile number (email only). */
  phone?: string | null;
  /** Channels the current code reached. Absent from an email-only API, which means email. */
  channels?: OtpChannel[];
  /** Why a channel was not reached, when one was not. */
  delivery?: OtpDelivery;
  emailSent?: boolean;
  smsSent?: boolean;
  /** False when the SMS carries its own code (Twilio Verify): the two messages hold different codes, either works. */
  sameCodeOnAllChannels?: boolean;
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

  register: async (input: RegisterInput): Promise<SignupOtpChallenge> =>
    toSignupChallenge((await request<SignupOtpResponse>("/auth/register", { method: "POST", body: input, skipAuthRefresh: true })).data),

  /** Activates the account. Signs nobody in — the user goes on to the login page. */
  verifySignupOtp: async (input: { verificationId: string; otp: string }) =>
    (await request<{ verified: true; user: AuthUser }>("/auth/register/verify-otp", { method: "POST", body: input, skipAuthRefresh: true })).data.user,

  /** Sends a new code; the previous one stops working. */
  resendSignupOtp: async (verificationId: string, channel: OtpChannel | "both" = "both"): Promise<SignupOtpChallenge> =>
    toSignupChallenge(
      (await request<SignupOtpResponse>("/auth/register/resend-otp", { method: "POST", body: { verificationId, channel }, skipAuthRefresh: true })).data,
    ),
  logout: async () => {
    try {
      await request<null>("/auth/logout", { method: "POST", skipAuthRefresh: true });
    } finally {
      resetSessionTracking();
    }
  },
  me: () => api.get<AuthUser>("/auth/me"),
};
