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
  { id: "commande", label: "Frage zu einer Bestellung" },
  { id: "produit", label: "Produktberatung" },
  { id: "service", label: "Kundendienst & Reklamation" },
  { id: "autre", label: "Sonstige Anfrage" },
];
const EMPTY = { name: "", email: "", subject: "", message: "" };
type Key = keyof typeof EMPTY;
const RULES: Record<Key, (v: string) => string | null> = {
  name: (v) => (v.trim().length >= 2 ? null : "Bitte geben Sie Ihren Namen an."),
  email: rules.email,
  subject: (v) => (v.trim() ? null : "Bitte wählen Sie ein Anliegen aus."),
  message: (v) => (v.trim().length >= 10 ? null : "Bitte geben Sie eine Nachricht mit mindestens 10 Zeichen ein."),
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
      setSent(res.data.message || "Ihre Nachricht wurde erfolgreich übermittelt!");
      setForm(EMPTY);
      f.reset();
    } else {
      const byField = serverFieldErrors(res.details);
      if (Object.keys(byField).length) return f.setServerErrors(byField);
      setError(res.status === 0 ? "Der Server antwortet nicht. Bitte überprüfen Sie Ihre Verbindung." : res.error || "Nachricht konnte nicht gesendet werden.");
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-5" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-paper">
          <IconCheck size={22} />
        </span>
        <p className="t-h3">{sent}</p>
        <p className="text-graphite">Wir antworten in der Regel innerhalb von 24 Stunden per E-Mail.</p>
        <button type="button" onClick={() => setSent(null)} className="text-sm underline underline-offset-4">
          Weitere Nachricht senden
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Vollständiger Name" htmlFor="name" required error={f.errors.name}>
        <Input id="name" name="name" {...field("name")} autoComplete="name" placeholder="Vor- und Nachname" />
      </Field>
      <Field label="E-Mail-Adresse" htmlFor="contact-email" required error={f.errors.email}>
        <Input id="contact-email" name="email" type="email" {...field("email")} autoComplete="email" placeholder="name@beispiel.de" />
      </Field>
      <Field label="Betreff" htmlFor="subject" required className="sm:col-span-2" error={f.errors.subject}>
        <NativeSelect id="subject" name="subject" {...field("subject")}>
          <option value="" disabled>
            Bitte ein Thema auswählen
          </option>
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Nachricht" htmlFor="message" required className="sm:col-span-2" error={f.errors.message}>
        <Textarea id="message" name="message" {...field("message")} placeholder="Bestellnummer, Modellbezeichnung oder Ihre Frage…" maxLength={5000} />
      </Field>
      <div className="sm:col-span-2">
        <FormError text={error} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={sending} plain={sending}>
          {sending ? (
            <>
              <Spinner /> Wird gesendet…
            </>
          ) : (
            "Nachricht senden"
          )}
        </Button>
      </div>
    </form>
  );
}

export default ContactForm;
