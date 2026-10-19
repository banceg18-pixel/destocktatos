"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Écrans d'accès au compte affichés sans pied de page (connexion, inscription, mot de passe). */
const WITHOUT_FOOTER = ["/connexion", "/inscription"];

export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (WITHOUT_FOOTER.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return children;
}
