import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { InscriptionForm } from "@/components/auth/InscriptionForm";
import { getSession, isGoogleEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Créer un compte", robots: { index: false, follow: true } };

export default async function InscriptionPage() {
  if ((await getSession())?.user) redirect("/compte");
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="En un clic avec Google, ou avec votre email et un mot de passe."
      footer={
        <p>
          Déjà client ?{" "}
          <Link href="/connexion" className="font-medium underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      }
    >
      <InscriptionForm googleEnabled={isGoogleEnabled()} />
    </AuthShell>
  );
}
