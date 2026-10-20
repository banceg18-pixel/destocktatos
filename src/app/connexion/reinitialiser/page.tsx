import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; creation?: string }> }) {
  const { token, creation } = await searchParams;
  const valid = !!token && /^[a-f0-9]{64}$/.test(token);
  // Après une commande sans compte : création du compte (le compte existe déjà, il manque le mot de passe).
  const create = creation === "1";
  return (
    <AuthShell
      title={create ? "Créez votre compte" : "Nouveau mot de passe"}
      subtitle={
        valid
          ? create
            ? "Choisissez votre mot de passe : vous retrouverez ensuite vos commandes et vos factures dans votre compte."
            : "Choisissez le mot de passe que vous utiliserez désormais."
          : undefined
      }
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
          <p>Ce lien est invalide ou incomplet. Les liens reçus par email ne servent qu&apos;une fois et ont une durée de validité limitée.</p>
          <Link href="/connexion/mot-de-passe-oublie" className="font-medium underline underline-offset-4">
            Demander un nouveau lien
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
