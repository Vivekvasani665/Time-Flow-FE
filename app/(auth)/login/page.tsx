import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // httpOnly cookies are only visible server-side; tells the client whether probing
  // for an existing session is worthwhile (avoids a pointless 401 → refresh → 401).
  const jar = await cookies();
  const hasSession = jar.has("tf_access") || jar.has("tf_session");

  return (
    <Suspense>
      <LoginScreen hasSession={hasSession} />
    </Suspense>
  );
}
