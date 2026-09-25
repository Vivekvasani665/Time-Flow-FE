import { api, request } from "@/lib/api/client";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@/lib/passkeys";
import type { Passkey, TwoFactorSetup, TwoFactorStatus } from "@/types/api";

/** Proof of the second factor for sensitive changes: a code (authenticator or recovery) or a passkey. */
export type TwoFactorProof = { code: string } | { passkey: AuthenticationResponseJSON };

/** Your own account's 2FA. Recovery codes are only ever returned once, here. */
export const twoFactorService = {
  status: () => api.get<TwoFactorStatus>("/auth/me/2fa"),

  /** Starts authenticator setup, or reopens a pending one — the same QR code either way. */
  setup: async (password: string) => (await api.post<TwoFactorSetup>("/auth/me/2fa/setup", { password })).data,
  cancelSetup: async () => {
    await api.delete<null>("/auth/me/2fa/setup");
  },
  /** `recoveryCodes` is null when 2FA was already on through a passkey. */
  enable: async (code: string) => (await api.post<{ recoveryCodes: string[] | null }>("/auth/me/2fa/enable", { code })).data,
  removeTotp: async (password: string) =>
    (await request<{ twoFactorEnabled: boolean }>("/auth/me/2fa/totp", { method: "DELETE", body: { password } })).data,

  /** Options for proving a passkey before disable / new recovery codes. */
  stepUpOptions: async () => (await api.post<PublicKeyCredentialRequestOptionsJSON>("/auth/me/2fa/step-up/options")).data,
  disable: async (input: { password: string } & TwoFactorProof) => {
    await api.post<null>("/auth/me/2fa/disable", input);
  },
  /** The previous recovery codes stop working immediately. */
  regenerateRecoveryCodes: async (proof: TwoFactorProof) => (await api.post<{ recoveryCodes: string[] }>("/auth/me/2fa/recovery-codes", proof)).data,

  passkeyOptions: async (password: string) => (await api.post<PublicKeyCredentialCreationOptionsJSON>("/auth/me/2fa/passkeys/options", { password })).data,
  /** `recoveryCodes` is set only when this passkey turned 2FA on. */
  addPasskey: async (input: { response: RegistrationResponseJSON; name?: string }) =>
    (await api.post<{ passkey: Passkey; recoveryCodes: string[] | null }>("/auth/me/2fa/passkeys", input)).data,
  removePasskey: async ({ id, password }: { id: string; password: string }) =>
    (await request<{ twoFactorEnabled: boolean }>(`/auth/me/2fa/passkeys/${id}`, { method: "DELETE", body: { password } })).data,
};
