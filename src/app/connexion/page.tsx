import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ConnexionForm } from "@/components/auth/ConnexionForm";
import { getSession, isGoogleEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anmelden", robots: { index: false, follow: true } };

export default async function ConnexionPage() {
  if ((await getSession())?.user) redirect("/compte");
  return (
    <AuthShell
      title="Anmelden"
      subtitle="Finden Sie Ihre Bestellungen, Rechnungen und Adressen."
      footer={
        <p>
          Noch kein Konto?{" "}
          <Link href="/inscription" className="font-medium underline underline-offset-4">
            Konto erstellen
          </Link>
        </p>
      }
    >
      {/* Page rendue à chaque requête : useSearchParams n'exige pas de <Suspense>, le formulaire part avec le HTML. */}
      <ConnexionForm googleEnabled={isGoogleEnabled()} />
    </AuthShell>
  );
}
