"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Primitives";
import { FormError } from "@/components/auth/ConnexionForm";
import { unsubscribeNewsletter } from "@/services/forms";

export function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });

  if (!email || !token) {
    return <p className="t-lead mt-6 max-w-xl text-graphite">Ce lien est incomplet. Utilisez le lien « Se désinscrire » présent en bas de nos emails.</p>;
  }
  if (state.kind === "done") {
    return (
      <div className="mt-6">
        <p className="t-lead max-w-xl text-graphite">C&apos;est fait : {email} ne recevra plus la newsletter. Vous pouvez vous réinscrire à tout moment depuis le bas de chaque page.</p>
        <ButtonLink href="/" className="mt-8">
          Retour à l&apos;accueil
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
      <p className="t-lead text-graphite">Vous ne recevrez plus nos offres à l&apos;adresse {email}.</p>
      <FormError text={state.kind === "error" ? (state.text ?? null) : null} />
      <Button size="lg" onClick={confirm} disabled={state.kind === "busy"} plain={state.kind === "busy"}>
        {state.kind === "busy" ? <Spinner /> : "Confirmer la désinscription"}
      </Button>
    </div>
  );
}
