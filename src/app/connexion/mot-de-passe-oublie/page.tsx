import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Passwort vergessen", robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Passwort vergessen"
      subtitle="Geben Sie Ihre E-Mail-Adresse ein: Wir senden Ihnen einen Link, um ein neues Passwort zu vergeben."
      footer={
        <Link href="/connexion" className="underline underline-offset-4">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
