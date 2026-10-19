"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerAccount } from "@/services/account";
import { Button } from "@/components/ui/Button";
import { Field, Input, Spinner } from "@/components/ui/Primitives";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { InputPassword } from "./InputPassword";
import { authInputClass } from "./AuthShell";
import { FormError, GoogleButton } from "./ConnexionForm";

type Key = "email" | "mdp" | "mdpv";

/**
 * `onSuccess` : appelé une fois le compte créé et connecté, à la place de la redirection (panier) ;
 * Google, qui quitte la page, n'est alors pas proposé.
 */
export function InscriptionForm({ googleEnabled, onSuccess }: { googleEnabled: boolean; onSuccess?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const f = useFieldErrors<Key>();
  const confirmRule = rules.confirmPassword(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.validateAll({ email, mdp: password, mdpv: confirm }, { email: rules.email, mdp: rules.newPassword, mdpv: confirmRule })) return;
    setLoading(true);
    const res = await registerAccount({ email, mdp: password, mdpv: confirm });
    if (!res.ok) {
      setLoading(false);
      if (res.status === 409) return f.setServerErrors({ email: "Un compte existe déjà avec cette adresse : connectez-vous, ou utilisez « Mot de passe oublié ? »." });
      const byField = serverFieldErrors(res.details);
      if (Object.keys(byField).length) return f.setServerErrors(byField);
      return setError(res.status === 0 ? "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez." : res.error || "Le compte n'a pas pu être créé.");
    }
    const login = await signIn("credentials", { email, mdp: password, callbackUrl: "/compte", redirect: false });
    if (login?.ok && !login.error) {
      if (onSuccess) return onSuccess();
      router.push("/compte");
      router.refresh();
      return;
    }
    setLoading(false);
    setError("Votre compte est créé, mais la connexion automatique a échoué. Connectez-vous.");
  };

  return (
    <div>
      {!onSuccess && <GoogleButton label="S'inscrire avec Google" callbackUrl="/compte" enabled={googleEnabled} disabled={loading} onError={setError} />}
      <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Email" htmlFor="email" error={f.errors.email}>
          <Input
            type="email"
            name="email"
            id="email"
            data-cy="signup-email-input"
            autoComplete="email"
            placeholder="nom@exemple.fr"
            value={email}
            invalid={!!f.errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              f.onChange("email", e.target.value, rules.email);
            }}
            onBlur={(e) => f.onBlur("email", e.target.value, rules.email)}
          />
        </Field>
        <Field label="Mot de passe" htmlFor="mdp" error={f.errors.mdp}>
          <InputPassword
            name="mdp"
            id="mdp"
            data-cy="signup-password-input"
            autoComplete="new-password"
            placeholder="Choisissez un mot de passe"
            className={authInputClass}
            invalid={!!f.errors.mdp}
            onChange={(e) => {
              setPassword(e.target.value);
              f.onChange("mdp", e.target.value, rules.newPassword);
              if (confirm) f.onChange("mdpv", confirm, rules.confirmPassword(e.target.value));
            }}
            onBlur={(e) => f.onBlur("mdp", e.target.value, rules.newPassword)}
          />
        </Field>
        <Field label="Confirmez le mot de passe" htmlFor="mdpv" error={f.errors.mdpv}>
          <InputPassword
            name="mdpv"
            id="mdpv"
            data-cy="signup-confirm-password-input"
            autoComplete="new-password"
            placeholder="Le même mot de passe"
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
        <Button type="submit" size="lg" block disabled={loading} plain={loading} data-cy="signup-submit">
          {loading ? (
            <>
              <Spinner /> Création du compte…
            </>
          ) : (
            "Créer mon compte"
          )}
        </Button>
      </form>
    </div>
  );
}

export default InscriptionForm;
