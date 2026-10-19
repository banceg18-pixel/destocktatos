"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProvider({ children, session }: { children: ReactNode; session?: Session | null }) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
