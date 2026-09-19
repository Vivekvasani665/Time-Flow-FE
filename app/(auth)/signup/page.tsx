import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  // Same probe as /login: a signed-in visitor is sent on to the app.
  const jar = await cookies();
  const hasSession = jar.has("tf_access") || jar.has("tf_session");

  return (
    <Suspense>
      <LoginScreen mode="signup" hasSession={hasSession} />
    </Suspense>
  );
}
