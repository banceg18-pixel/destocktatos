import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neues Passwort", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; creation?: string }> }) {
  const { token, creation } = await searchParams;
  const valid = !!token && /^[a-f0-9]{64}$/.test(token);
  // Après une commande sans compte : création du compte (le compte existe déjà, il manque le mot de passe).
  const create = creation === "1";
  return (
    <AuthShell
      title={create ? "Konto erstellen" : "Neues Passwort"}
      subtitle={
        valid
          ? create
            ? "Legen Sie Ihr Passwort fest: Anschließend können Sie Ihre Bestellungen und Rechnungen in Ihrem Konto einsehen."
            : "Wählen Sie ein neues sicheres Passwort für Ihr Konto."
          : undefined
      }
      footer={
        <Link href="/connexion" className="underline underline-offset-4">
          Zurück zur Anmeldung
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token!} />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p>Dieser Link ist ungültig oder abgelaufen. Sicherheitslinks aus E-Mails können nur einmal verwendet werden und sind zeitlich befristet.</p>
          <Link href="/connexion/mot-de-passe-oublie" className="font-medium underline underline-offset-4">
            Neuen Link anfordern
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
