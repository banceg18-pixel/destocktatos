"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/Button";
import { Field, Input, Spinner } from "@/components/ui/Primitives";
import { IconAlert } from "@/components/ui/Icons";
import { rules } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { InputPassword } from "./InputPassword";
import { authInputClass } from "./AuthShell";

/** Redirection interne uniquement (évite les redirections ouvertes via ?callbackUrl=). */
export function safeCallback(raw: string | null, fallback = "/compte") {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex gap-2.5 border border-danger/30 bg-danger/5 p-3.5 text-sm text-danger">
      <IconAlert size={16} className="mt-0.5 shrink-0" /> {text}
    </p>
  );
}

/** Erreurs renvoyées par NextAuth sur /connexion?error=… */
const AUTH_ERRORS: Record<string, string> = {
  GoogleEmail: "Dieses Google-Konto hat keine verifizierte E-Mail-Adresse. Bitte wählen Sie ein anderes Konto.",
  AccessDenied: "Die Anmeldung mit Google wurde abgebrochen.",
  OAuthSignin: "Die Google-Anmeldung konnte nicht gestartet werden. Bitte versuchen Sie es gleich erneut.",
  OAuthCallback: "Die Anmeldung über Google ist fehlgeschlagen. Bitte nutzen Sie E-Mail und Passwort.",
  Callback: "Die Anmeldung ist fehlgeschlagen.",
  OAuthAccountNotLinked: "Diese E-Mail-Adresse ist bereits mit einer anderen Anmeldemethode verknüpft.",
  SessionRequired: "Bitte melden Sie sich an, um auf diese Seite zuzugreifen.",
};
export const authErrorMessage = (code: string | null) => (code ? (AUTH_ERRORS[code] ?? "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.") : null);

/**
 * Bouton « Continuer avec Google »
 */
export function GoogleButton({ label, callbackUrl, enabled, disabled, onError }: { label: string; callbackUrl: string; enabled: boolean; disabled?: boolean; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // Retour arrière depuis la page Google : la page restaurée ne reste pas « en attente ».
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const start = async () => {
    if (!enabled) {
      onError("Google-Login ist auf dieser Website derzeit nicht verfügbar. Bitte nutzen Sie Ihre E-Mail-Adresse.");
      return;
    }
    setPending(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setPending(false);
      onError("Google konnte nicht erreicht werden. Bitte prüfen Sie Ihre Internetverbindung.");
    }
  };
  return (
    <>
      <Button variant="outline" size="lg" block plain disabled={disabled || pending} onClick={start} data-cy="google-signin">
        {pending ? <Spinner /> : <FcGoogle size={20} aria-hidden="true" />}
        {pending ? "Weiterleitung zu Google…" : label}
      </Button>
      <div className="my-7 flex items-center gap-4 text-xs text-graphite">
        <span className="h-px flex-1 bg-line" /> oder mit Ihrer E-Mail-Adresse <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

type Key = "email" | "mdp";

/**
 * `onSuccess` : appelé une fois connecté, à la place de la redirection (connexion depuis le panier) ;
 * Google, qui quitte la page, n'est alors pas proposé.
 */
export function ConnexionForm({ googleEnabled, onSuccess }: { googleEnabled: boolean; onSuccess?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => authErrorMessage(params.get("error")));
  const f = useFieldErrors<Key>();
  const validators = { email: rules.email, mdp: rules.loginPassword };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.validateAll({ email, mdp: password }, validators)) return;
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, mdp: password, callbackUrl, redirect: false });
      if (res?.ok && !res.error) {
        if (onSuccess) return onSuccess();
        router.push(callbackUrl);
        router.refresh();
        return;
      }
      setLoading(false);
      setError(
        res?.error && res.error !== "CredentialsSignin"
          ? res.error
          : "E-Mail-Adresse oder Passwort ungültig. Bitte überprüfen Sie Ihre Eingaben.",
      );
    } catch {
      setLoading(false);
      setError("Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Netzwerkverbindung.");
    }
  };

  return (
    <div>
      {!onSuccess && <GoogleButton label="Mit Google fortfahren" callbackUrl={callbackUrl} enabled={googleEnabled} disabled={loading} onError={setError} />}
      {/* method="post" : si l'on clique avant que la page soit prête, le mot de passe ne part jamais dans l'adresse. */}
      <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="E-Mail-Adresse" htmlFor="email" error={f.errors.email}>
          <Input
            type="email"
            name="email"
            id="email"
            data-cy="email-input"
            autoComplete="email"
            placeholder="ihre.email@beispiel.de"
            value={email}
            invalid={!!f.errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              f.onChange("email", e.target.value, rules.email);
            }}
            onBlur={(e) => f.onBlur("email", e.target.value, rules.email)}
          />
        </Field>
        <Field label="Passwort" htmlFor="mdp" error={f.errors.mdp}>
          <InputPassword
            name="mdp"
            id="mdp"
            data-cy="password-input"
            autoComplete="current-password"
            placeholder="Ihr Passwort"
            className={authInputClass}
            invalid={!!f.errors.mdp}
            onChange={(e) => {
              setPassword(e.target.value);
              f.onChange("mdp", e.target.value, rules.loginPassword);
            }}
            onBlur={(e) => f.onBlur("mdp", e.target.value, rules.loginPassword)}
          />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/connexion/mot-de-passe-oublie" className="text-sm underline-offset-4 hover:underline">
            Passwort vergessen?
          </Link>
        </div>
        <FormError text={error} />
        <Button type="submit" size="lg" block disabled={loading} plain={loading} data-cy="login-submit">
          {loading ? (
            <>
              <Spinner /> Anmeldung…
            </>
          ) : (
            "Anmelden"
          )}
        </Button>
      </form>
    </div>
  );
}

export default ConnexionForm;
