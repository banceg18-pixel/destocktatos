"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Primitives";
import { FormError } from "@/components/auth/ConnexionForm";
import { unsubscribeNewsletter } from "@/services/forms";

export function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });

  if (!email || !token) {
    return <p className="t-lead mt-6 max-w-xl text-graphite">Dieser Link ist ungültig oder unvollständig. Bitte nutzen Sie den Abmelde-Link am Ende unserer E-Mails.</p>;
  }
  if (state.kind === "done") {
    return (
      <div className="mt-6">
        <p className="t-lead max-w-xl text-graphite">Erledigt: {email} erhält ab sofort keinen Newsletter mehr. Sie können sich jederzeit am Seitenende wieder anmelden.</p>
        <ButtonLink href="/" className="mt-8">
          Zur Startseite
        </ButtonLink>
      </div>
    );
  }
  const confirm = async () => {
    setState({ kind: "busy" });
    const res = await unsubscribeNewsletter(email, token);
    setState(res.ok ? { kind: "done" } : { kind: "error", text: res.error });
  };
  return (
    <div className="mt-6 flex max-w-xl flex-col items-start gap-6">
      <p className="t-lead text-graphite">Sie erhalten unter der Adresse {email} keine Angebote mehr.</p>
      <FormError text={state.kind === "error" ? (state.text ?? null) : null} />
      <Button size="lg" onClick={confirm} disabled={state.kind === "busy"} plain={state.kind === "busy"}>
        {state.kind === "busy" ? <Spinner /> : "Abmeldung bestätigen"}
      </Button>
    </div>
  );
}
