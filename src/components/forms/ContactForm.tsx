"use client";

import { useState } from "react";
import { sendContact } from "@/services/forms";
import { Button } from "@/components/ui/Button";
import { Field, Input, NativeSelect, Spinner, Textarea } from "@/components/ui/Primitives";
import { IconCheck } from "@/components/ui/Icons";
import { FormError } from "@/components/auth/ConnexionForm";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { bindField, useFieldErrors } from "@/lib/client/use-field-errors";

const SUBJECTS = [
  { id: "commande", label: "Question sur une commande" },
  { id: "produit", label: "Renseignement sur un produit" },
  { id: "service", label: "Service après-vente" },
  { id: "autre", label: "Autre demande" },
];
const EMPTY = { name: "", email: "", subject: "", message: "" };
type Key = keyof typeof EMPTY;
const RULES: Record<Key, (v: string) => string | null> = {
  name: rules.name,
  email: rules.email,
  subject: rules.choice("le sujet de votre message"),
  message: rules.text("votre message", 10),
};

/** Formulaire de contact : validation locale, enregistrement côté serveur, confirmation affichée. */
export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const f = useFieldErrors<Key>({ email: "contact-email" });
  const field = (k: Key) => bindField(f, k, form[k], (v) => setForm((s) => ({ ...s, [k]: v })), RULES[k]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.validateAll(form, RULES)) return;
    setSending(true);
    const res = await sendContact(form);
    setSending(false);
    if (res.ok) {
      setSent(res.data.message || "Votre message a été envoyé avec succès !");
      setForm(EMPTY);
      f.reset();
    } else {
      const byField = serverFieldErrors(res.details);
      if (Object.keys(byField).length) return f.setServerErrors(byField);
      setError(res.status === 0 ? "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez." : res.error || "Le message n'a pas pu être envoyé.");
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-5" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-paper">
          <IconCheck size={22} />
        </span>
        <p className="t-h3">{sent}</p>
        <p className="text-graphite">Nous répondons par email, en général sous 24 heures.</p>
        <button type="button" onClick={() => setSent(null)} className="text-sm underline underline-offset-4">
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Nom" htmlFor="name" required error={f.errors.name}>
        <Input id="name" name="name" {...field("name")} autoComplete="name" placeholder="Prénom et nom" />
      </Field>
      <Field label="Email" htmlFor="contact-email" required error={f.errors.email}>
        <Input id="contact-email" name="email" type="email" {...field("email")} autoComplete="email" placeholder="nom@exemple.fr" />
      </Field>
      <Field label="Sujet" htmlFor="subject" required className="sm:col-span-2" error={f.errors.subject}>
        <NativeSelect id="subject" name="subject" {...field("subject")}>
          <option value="" disabled>
            Choisissez un sujet
          </option>
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Message" htmlFor="message" required className="sm:col-span-2" error={f.errors.message}>
        <Textarea id="message" name="message" {...field("message")} placeholder="Référence du produit, numéro de commande, question…" maxLength={5000} />
      </Field>
      <div className="sm:col-span-2">
        <FormError text={error} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={sending} plain={sending}>
          {sending ? (
            <>
              <Spinner /> Envoi…
            </>
          ) : (
            "Envoyer le message"
          )}
        </Button>
      </div>
    </form>
  );
}

export default ContactForm;
