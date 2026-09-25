import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/browser";

export type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON };

/** False on old browsers and in insecure contexts (plain http on a non-localhost host). */
export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/** Thrown when the person dismissed the browser's passkey prompt: not an error worth shouting about. */
export class PasskeyCancelledError extends Error {
  constructor() {
    super("Passkey request was cancelled.");
    this.name = "PasskeyCancelledError";
  }
}

function translate(error: unknown): never {
  // NotAllowedError covers both "cancelled" and "timed out" — browsers do not tell them apart.
  if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError")) throw new PasskeyCancelledError();
  if (error instanceof Error && error.name === "InvalidStateError") {
    throw new Error("This device already has a passkey for your account.");
  }
  throw error instanceof Error ? error : new Error("The passkey request failed.");
}

/** Face ID / Touch ID / Windows Hello / security key prompt to create a passkey. */
export async function createPasskey(optionsJSON: PublicKeyCredentialCreationOptionsJSON): Promise<RegistrationResponseJSON> {
  try {
    return await startRegistration({ optionsJSON });
  } catch (error) {
    translate(error);
  }
}

/** Prompt to prove an existing passkey. */
export async function provePasskey(optionsJSON: PublicKeyCredentialRequestOptionsJSON): Promise<AuthenticationResponseJSON> {
  try {
    return await startAuthentication({ optionsJSON });
  } catch (error) {
    translate(error);
  }
}
