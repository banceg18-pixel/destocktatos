"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/services/account";
import { Button } from "@/components/ui/Button";
import { Field, Input, Spinner } from "@/components/ui/Primitives";
import { IconMail } from "@/components/ui/Icons";
import { FormError } from "./ConnexionForm";
import { rules } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const f = useFieldErrors<"email">();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.validateAll({ email }, { email: rules.email })) return;
    setLoading(true);
    const res = await requestPasswordReset(email);
    setLoading(false);
    if (res.ok) {
      setSentTo(email);
      setEmail("");
    } else setError(res.error || "La demande n'a pas abouti. Réessayez dans un instant.");
  };

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-mist">
          <IconMail size={22} />
        </span>
        <p>
          Eine E-Mail zum Zurücksetzen Ihres Passworts wurde an <strong>{sentTo}</strong> gesendet, sofern ein Konto existiert. Der Link ist eine Stunde gültig.
        </p>
        <p className="text-sm text-graphite">Bitte überprüfen Sie auch Ihren Spam-Ordner.</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/connexion" className="font-medium underline underline-offset-4">
            Zurück zur Anmeldung
          </Link>
          <button type="button" onClick={() => setSentTo(null)} className="underline-offset-4 hover:underline">
            Andere E-Mail-Adresse verwenden
          </button>
        </div>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="E-Mail-Adresse" htmlFor="email" error={f.errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          placeholder="name@beispiel.de"
          invalid={!!f.errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            f.onChange("email", e.target.value, rules.email);
          }}
          onBlur={(e) => f.onBlur("email", e.target.value, rules.email)}
        />
      </Field>
      <FormError text={error} />
      <Button type="submit" size="lg" block disabled={loading} plain={loading}>
        {loading ? (
          <>
            <Spinner /> Wird gesendet…
          </>
        ) : (
          "Link anfordern"
        )}
      </Button>
    </form>
  );
}

export default ForgotPasswordForm;
