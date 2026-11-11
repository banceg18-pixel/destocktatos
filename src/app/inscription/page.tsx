import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { InscriptionForm } from "@/components/auth/InscriptionForm";
import { getSession, isGoogleEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konto erstellen", robots: { index: false, follow: true } };

export default async function InscriptionPage() {
  if ((await getSession())?.user) redirect("/compte");
  return (
    <AuthShell
      title="Konto erstellen"
      subtitle="Mit einem Klick über Google oder mit Ihrer E-Mail-Adresse und einem Passwort."
      footer={
        <p>
          Bereits Kunde?{" "}
          <Link href="/connexion" className="font-medium underline underline-offset-4">
            Anmelden
          </Link>
        </p>
      }
    >
      <InscriptionForm googleEnabled={isGoogleEnabled()} />
    </AuthShell>
  );
}
