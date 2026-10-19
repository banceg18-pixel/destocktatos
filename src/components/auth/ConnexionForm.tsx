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

/** Erreurs renvoyées par NextAuth sur /connexion?error=… (connexion Google interrompue, refusée…). */
const AUTH_ERRORS: Record<string, string> = {
  GoogleEmail: "Ce compte Google n'a pas d'adresse email vérifiée : il ne peut pas être utilisé ici. Choisissez un autre compte ou créez un compte avec votre email.",
  AccessDenied: "La connexion avec Google a été annulée. Vous pouvez réessayer, ou utiliser votre email et votre mot de passe.",
  OAuthSignin: "La connexion avec Google n'a pas pu démarrer. Réessayez dans un instant.",
  OAuthCallback: "La connexion avec Google n'a pas abouti. Réessayez, ou utilisez votre email et votre mot de passe.",
  Callback: "La connexion avec Google n'a pas abouti. Réessayez, ou utilisez votre email et votre mot de passe.",
  OAuthAccountNotLinked: "Cette adresse est déjà associée à un autre mode de connexion. Connectez-vous avec votre email et votre mot de passe.",
  SessionRequired: "Connectez-vous pour accéder à cette page.",
};
export const authErrorMessage = (code: string | null) => (code ? (AUTH_ERRORS[code] ?? "La connexion n'a pas abouti. Réessayez.") : null);

/**
 * Bouton « Continuer avec Google », toujours affiché en tête des formulaires de connexion et
 * d'inscription. Le compte client est retrouvé par son email, ou créé à la première connexion.
 * Tant que la connexion Google n'est pas activée sur le serveur (identifiants Google absents),
 * le bouton l'indique au lieu d'ouvrir une page d'erreur.
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
      onError("La connexion avec Google n'est pas encore disponible sur ce site. Utilisez votre adresse email ci-dessous.");
      return;
    }
    setPending(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setPending(false);
      onError("Impossible de joindre Google pour le moment. Vérifiez votre connexion puis réessayez.");
    }
  };
  return (
    <>
      <Button variant="outline" size="lg" block plain disabled={disabled || pending} onClick={start} data-cy="google-signin">
        {pending ? <Spinner /> : <FcGoogle size={20} aria-hidden="true" />}
        {pending ? "Redirection vers Google…" : label}
      </Button>
      <div className="my-7 flex items-center gap-4 text-xs text-graphite">
        <span className="h-px flex-1 bg-line" /> ou avec votre email <span className="h-px flex-1 bg-line" />
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
          : "Email ou mot de passe incorrect. Vérifiez l'adresse et le mot de passe, ou utilisez « Mot de passe oublié ? ». Compte créé avec Google ? Utilisez le bouton Google.",
      );
    } catch {
      setLoading(false);
      setError("La connexion n'a pas abouti. Vérifiez votre réseau puis réessayez.");
    }
  };

  return (
    <div>
      {!onSuccess && <GoogleButton label="Continuer avec Google" callbackUrl={callbackUrl} enabled={googleEnabled} disabled={loading} onError={setError} />}
      {/* method="post" : si l'on clique avant que la page soit prête, le mot de passe ne part jamais dans l'adresse. */}
      <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Email" htmlFor="email" error={f.errors.email}>
          <Input
            type="email"
            name="email"
            id="email"
            data-cy="email-input"
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
            data-cy="password-input"
            autoComplete="current-password"
            placeholder="Votre mot de passe"
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
            Mot de passe oublié ?
          </Link>
        </div>
        <FormError text={error} />
        <Button type="submit" size="lg" block disabled={loading} plain={loading} data-cy="login-submit">
          {loading ? (
            <>
              <Spinner /> Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>
    </div>
  );
}

export default ConnexionForm;
