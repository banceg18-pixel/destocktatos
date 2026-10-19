"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Spinner } from "@/components/ui/Primitives";
import { IconCheck } from "@/components/ui/Icons";
import { InputPassword } from "@/components/auth/InputPassword";
import { authInputClass } from "@/components/auth/AuthShell";
import { FormError } from "@/components/auth/ConnexionForm";
import { changePassword, deleteAccount, updateProfile } from "@/services/account";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";

function Saved({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-success">
      <IconCheck size={16} /> {text}
    </p>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10 first:border-t-0">
      <h2 className="t-h3">{title}</h2>
      {intro && <p className="mt-2 max-w-xl text-sm text-graphite">{intro}</p>}
      <div className="mt-6 max-w-md">{children}</div>
    </section>
  );
}

export function ProfileForms({ name: initialName, email, hasPassword: initialHasPassword, googleEnabled }: { name: string; email: string; hasPassword: boolean; googleEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nameState, setNameState] = useState<{ busy: boolean; error: string | null; ok: string | null }>({ busy: false, error: null, ok: null });
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [pwd, setPwd] = useState({ current: "", mdp: "", mdpv: "" });
  const [pwdState, setPwdState] = useState<{ busy: boolean; error: string | null; ok: string | null }>({ busy: false, error: null, ok: null });
  const [confirm, setConfirm] = useState("");
  const [delState, setDelState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const nf = useFieldErrors<"name">({ name: "profile-name" });
  const pf = useFieldErrors<"current" | "mdp" | "mdpv">({ current: "pwd-current", mdp: "pwd-new", mdpv: "pwd-confirm" });
  const pwdRules = { current: hasPassword ? rules.currentPassword : () => null, mdp: rules.newPassword, mdpv: rules.confirmPassword(pwd.mdp) };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nf.validateAll({ name }, { name: rules.name })) return;
    setNameState({ busy: true, error: null, ok: null });
    const res = await updateProfile(name);
    if (!res.ok) {
      setNameState({ busy: false, error: null, ok: null });
      const byField = serverFieldErrors(res.details);
      return Object.keys(byField).length ? nf.setServerErrors(byField) : setNameState({ busy: false, error: res.error, ok: null });
    }
    setNameState({ busy: false, error: null, ok: "Nom enregistré." });
    router.refresh();
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pf.validateAll(pwd, pwdRules)) return;
    setPwdState({ busy: true, error: null, ok: null });
    const res = await changePassword({ current: hasPassword ? pwd.current : undefined, mdp: pwd.mdp, mdpv: pwd.mdpv });
    if (!res.ok) {
      setPwdState({ busy: false, error: null, ok: null });
      if (/actuel/i.test(res.error)) return pf.setServerErrors({ current: res.error });
      const byField = serverFieldErrors(res.details);
      return Object.keys(byField).length ? pf.setServerErrors(byField) : setPwdState({ busy: false, error: res.error, ok: null });
    }
    pf.reset();
    setPwd({ current: "", mdp: "", mdpv: "" });
    setHasPassword(true);
    setPwdState({ busy: false, error: null, ok: res.data.message });
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelState({ busy: true, error: null });
    const res = await deleteAccount(confirm.trim());
    if (!res.ok) return setDelState({ busy: false, error: res.error });
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="mt-8">
      <Section title="Identité" intro="Votre nom apparaît sur vos factures et dans les emails de suivi.">
        <form onSubmit={saveName} noValidate className="flex flex-col gap-5">
          <Field label="Nom complet" htmlFor="profile-name" error={nf.errors.name}>
            <Input
              id="profile-name"
              autoComplete="name"
              value={name}
              invalid={!!nf.errors.name}
              onChange={(e) => {
                setName(e.target.value);
                nf.onChange("name", e.target.value, rules.name);
              }}
              onBlur={(e) => nf.onBlur("name", e.target.value, rules.name)}
            />
          </Field>
          <Field label="Email" htmlFor="profile-email" hint="L'adresse email ne peut pas être modifiée : contactez le magasin si besoin.">
            <Input id="profile-email" value={email} readOnly disabled />
          </Field>
          <FormError text={nameState.error} />
          <Saved text={nameState.ok} />
          <Button type="submit" disabled={nameState.busy || name.trim() === initialName} plain={nameState.busy} className="self-start">
            {nameState.busy ? <Spinner /> : "Enregistrer le nom"}
          </Button>
        </form>
      </Section>

      <Section
        title={hasPassword ? "Mot de passe" : "Créer un mot de passe"}
        intro={hasPassword ? undefined : `Votre compte a été créé avec Google${googleEnabled ? "" : " (connexion Google actuellement indisponible)"}. Définissez un mot de passe pour pouvoir aussi vous connecter avec votre email.`}
      >
        <form method="post" onSubmit={savePassword} noValidate className="flex flex-col gap-5">
          {hasPassword && (
            <Field label="Mot de passe actuel" htmlFor="pwd-current" error={pf.errors.current}>
              <InputPassword
                id="pwd-current"
                name="current"
                autoComplete="current-password"
                className={authInputClass}
                value={pwd.current}
                invalid={!!pf.errors.current}
                onChange={(e) => {
                  setPwd({ ...pwd, current: e.target.value });
                  pf.onChange("current", e.target.value, pwdRules.current);
                }}
                onBlur={(e) => pf.onBlur("current", e.target.value, pwdRules.current)}
              />
            </Field>
          )}
          <Field label="Nouveau mot de passe" htmlFor="pwd-new" error={pf.errors.mdp}>
            <InputPassword
              id="pwd-new"
              name="mdp"
              autoComplete="new-password"
              className={authInputClass}
              value={pwd.mdp}
              invalid={!!pf.errors.mdp}
              onChange={(e) => {
                setPwd({ ...pwd, mdp: e.target.value });
                pf.onChange("mdp", e.target.value, rules.newPassword);
              }}
              onBlur={(e) => pf.onBlur("mdp", e.target.value, rules.newPassword)}
            />
          </Field>
          <Field label="Confirmez le nouveau mot de passe" htmlFor="pwd-confirm" error={pf.errors.mdpv}>
            <InputPassword
              id="pwd-confirm"
              name="mdpv"
              autoComplete="new-password"
              className={authInputClass}
              value={pwd.mdpv}
              invalid={!!pf.errors.mdpv}
              onChange={(e) => {
                setPwd({ ...pwd, mdpv: e.target.value });
                pf.onChange("mdpv", e.target.value, pwdRules.mdpv);
              }}
              onBlur={(e) => pf.onBlur("mdpv", e.target.value, pwdRules.mdpv)}
            />
          </Field>
          <FormError text={pwdState.error} />
          <Saved text={pwdState.ok} />
          <Button type="submit" disabled={pwdState.busy || !pwd.mdp} plain={pwdState.busy} className="self-start">
            {pwdState.busy ? <Spinner /> : hasPassword ? "Changer le mot de passe" : "Créer le mot de passe"}
          </Button>
        </form>
      </Section>

      <Section title="Supprimer mon compte" intro="Vos adresses, vos avis et vos accès sont effacés. Les commandes passées restent archivées de façon anonyme pour la comptabilité. Cette action est définitive.">
        <form onSubmit={remove} noValidate className="flex flex-col gap-5">
          <Field label="Tapez SUPPRIMER pour confirmer" htmlFor="delete-confirm">
            <Input id="delete-confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <FormError text={delState.error} />
          <Button type="submit" variant="outline" disabled={delState.busy || confirm.trim() !== "SUPPRIMER"} plain={delState.busy} className="self-start border-danger text-danger hover:bg-danger hover:text-paper">
            {delState.busy ? <Spinner /> : "Supprimer définitivement"}
          </Button>
        </form>
      </Section>
    </div>
  );
}
