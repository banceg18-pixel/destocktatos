"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Primitives";
import { requestPasswordReset } from "@/services/account";

/**
 * Après une commande sans compte : invitation à créer son compte (lien envoyé par email avec la
 * facture, renvoyable ici) ou à se connecter, pour retrouver ses commandes et factures.
 */
export function AccountInvite({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const login = `/connexion?callbackUrl=${encodeURIComponent("/compte/commandes")}`;
  if (hasPassword) {
    return (
      <div className="mt-8 max-w-xl border border-line p-5 sm:p-6" data-testid="account-invite">
        <p className="font-medium">Ihr Kundenbereich</p>
        <p className="mt-2 text-sm text-graphite">Melden Sie sich an, um Ihre Bestellung zu verfolgen und jederzeit auf Ihre Rechnungen zuzugreifen.</p>
        <ButtonLink href={login} size="md" className="mt-5">
          Anmelden
        </ButtonLink>
      </div>
    );
  }
  const send = async () => {
    setState("sending");
    const res = await requestPasswordReset(email);
    setState(res.ok ? "sent" : "error");
  };
  return (
    <div className="mt-8 max-w-xl border border-line p-5 sm:p-6" data-testid="account-invite">
      <p className="font-medium">Erstellen Sie Ihr Konto, um Ihre Rechnungen einzusehen</p>
      <p className="mt-2 text-sm text-graphite">
        Ihr Konto ist für die E-Mail-Adresse <strong className="text-ink">{email}</strong> vorbereitet: Vergeben Sie lediglich Ihr persönliches Passwort über den Link in Ihrer Bestätigungs-E-Mail.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button size="md" onClick={send} disabled={state === "sending" || state === "sent"} plain={state !== "idle"}>
          {state === "sending" ? <Spinner /> : state === "sent" ? "Link gesendet" : "Link erneut anfordern"}
        </Button>
        <a href={login} className="text-sm underline underline-offset-4">
          Ich habe bereits ein Passwort
        </a>
      </div>
      {state === "sent" && (
        <p role="status" className="mt-3 text-sm text-graphite">
          Ein neuer Zugangslink wurde an {email} gesendet.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-danger">
          Versand fehlgeschlagen. Bitte versuchen Sie es in Kürze erneut.
        </p>
      )}
    </div>
  );
}
