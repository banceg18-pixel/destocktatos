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
        <p className="font-medium">Votre espace client</p>
        <p className="mt-2 text-sm text-graphite">Connectez-vous pour suivre votre commande et retrouver vos factures à tout moment.</p>
        <ButtonLink href={login} size="md" className="mt-5">
          Me connecter
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
      <p className="font-medium">Créez votre compte pour retrouver vos factures</p>
      <p className="mt-2 text-sm text-graphite">
        Votre compte est prêt à l&apos;adresse <strong className="text-ink">{email}</strong> : il ne manque que votre mot de passe. Choisissez-le avec le lien
        « Créer mon compte » reçu par email avec votre facture.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button size="md" onClick={send} disabled={state === "sending" || state === "sent"} plain={state !== "idle"}>
          {state === "sending" ? <Spinner /> : state === "sent" ? "Lien envoyé" : "Recevoir à nouveau le lien"}
        </Button>
        <a href={login} className="text-sm underline underline-offset-4">
          J&apos;ai déjà un mot de passe
        </a>
      </div>
      {state === "sent" && (
        <p role="status" className="mt-3 text-sm text-graphite">
          Un nouveau lien vient de vous être envoyé à {email}.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-danger">
          L&apos;envoi a échoué. Réessayez dans un instant.
        </p>
      )}
    </div>
  );
}
