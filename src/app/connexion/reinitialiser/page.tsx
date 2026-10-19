import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = !!token && /^[a-f0-9]{64}$/.test(token);
  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle={valid ? "Choisissez le mot de passe que vous utiliserez désormais." : undefined}
      footer={
        <Link href="/connexion" className="underline underline-offset-4">
          Retour à la connexion
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token!} />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p>Ce lien est invalide ou incomplet. Les liens de réinitialisation ne servent qu&apos;une fois et expirent au bout d&apos;une heure.</p>
          <Link href="/connexion/mot-de-passe-oublie" className="font-medium underline underline-offset-4">
            Demander un nouveau lien
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
