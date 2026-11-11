"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMessage } from "@/context/PopUpProvider";
import { resetPassword } from "@/services/account";
import { Button } from "@/components/ui/Button";
import { Field, Spinner } from "@/components/ui/Primitives";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { InputPassword } from "./InputPassword";
import { authInputClass } from "./AuthShell";
import { FormError } from "./ConnexionForm";

type Key = "mdp" | "mdpv";

/** Choix d'un nouveau mot de passe à partir du lien reçu par email. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { setMessage } = useMessage();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const f = useFieldErrors<Key>();
  const confirmRule = rules.confirmPassword(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.validateAll({ mdp: password, mdpv: confirm }, { mdp: rules.newPassword, mdpv: confirmRule })) return;
    setLoading(true);
    const res = await resetPassword(token, password);
    setLoading(false);
    if (!res.ok) {
      const byField = serverFieldErrors(res.details);
      return Object.keys(byField).length ? f.setServerErrors(byField) : setError(res.error);
    }
    setMessage("Ihr Passwort wurde erfolgreich geändert. Sie können sich nun anmelden.");
    // Connexion, puis directement les commandes et factures.
    router.push(`/connexion?callbackUrl=${encodeURIComponent("/compte/commandes")}`);
  };

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Neues Passwort" htmlFor="mdp" error={f.errors.mdp}>
        <InputPassword
          name="mdp"
          id="mdp"
          autoComplete="new-password"
          placeholder="Neues Passwort"
          className={authInputClass}
          invalid={!!f.errors.mdp}
          onChange={(e) => {
            setPassword(e.target.value);
            f.onChange("mdp", e.target.value, rules.newPassword);
          }}
          onBlur={(e) => f.onBlur("mdp", e.target.value, rules.newPassword)}
        />
      </Field>
      <Field label="Passwort bestätigen" htmlFor="mdpv" error={f.errors.mdpv}>
        <InputPassword
          name="mdpv"
          id="mdpv"
          autoComplete="new-password"
          placeholder="Passwort wiederholen"
          className={authInputClass}
          invalid={!!f.errors.mdpv}
          onChange={(e) => {
            setConfirm(e.target.value);
            f.onChange("mdpv", e.target.value, confirmRule);
          }}
          onBlur={(e) => f.onBlur("mdpv", e.target.value, confirmRule)}
        />
      </Field>
      <FormError text={error} />
      <Button type="submit" size="lg" block disabled={loading} plain={loading}>
        {loading ? (
          <>
            <Spinner /> Wird gespeichert…
          </>
        ) : (
          "Passwort speichern"
        )}
      </Button>
    </form>
  );
}

export default ResetPasswordForm;
