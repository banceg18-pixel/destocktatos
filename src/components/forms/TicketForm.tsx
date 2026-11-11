"use client";
/* eslint-disable @next/next/no-img-element -- aperçu local (URL blob) de la capture choisie */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { createTicket, uploadTicketImages } from "@/services/forms";
import { Button } from "@/components/ui/Button";
import { Field, Input, NativeSelect, Spinner, Textarea } from "@/components/ui/Primitives";
import { IconCheck, IconClose, IconPlus } from "@/components/ui/Icons";
import { FormError } from "@/components/auth/ConnexionForm";
import { ChoiceCard } from "@/components/cart/ShippingAddressForm";

const TYPES = [
  { value: "bug", label: "Ein Problem", text: "Etwas funktioniert nicht wie erwartet" },
  { value: "amelioration", label: "Eine Verbesserung", text: "Eine Seite oder Funktion optimieren" },
  { value: "fonctionnalite", label: "Eine Idee", text: "Ein Vorschlag oder fehlende Funktion" },
];
const PRIORITIES = [
  { value: "basse", label: "Niedrig — geringfügige Beeinträchtigung" },
  { value: "normale", label: "Normal" },
  { value: "haute", label: "Hoch — spürbare Beeinträchtigung" },
  { value: "critique", label: "Kritisch — Bestellung nicht möglich" },
];
const EMPTY = { titre: "", description: "", type: "bug", priorite: "normale", email: "", navigateur: "", url: "" };
const MAX = 5 * 1024 * 1024;

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return "Andere";
}

/** Problem melden (Support-Ticket mit optionalem Screenshot). */
export function TicketForm() {
  const { data: session } = useSession();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const f = useFieldErrors<"titre" | "description" | "email" | "url">();
  const RULES = {
    titre: rules.text("einen aussagekräftigen Titel", 5),
    description: rules.text("eine Beschreibung (was Sie getan haben und was passiert ist)", 15),
    email: session?.user ? () => null : rules.email,
    url: rules.optional((v: string) => (/^https?:\/\/\S+$/.test(v.trim()) ? null : "Ungültige Seitenadresse: Sie muss mit https:// beginnen (oder Feld leer lassen).")),
  };
  const bind = (k: keyof typeof RULES) => ({
    invalid: !!f.errors[k],
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => f.onBlur(k, e.target.value, RULES[k]),
  });

  useEffect(() => {
    setForm((f) => ({ ...f, navigateur: f.navigateur || detectBrowser(), url: f.url || document.referrer || "" }));
  }, []);
  useEffect(() => {
    if (session?.user?.email) setForm((f) => ({ ...f, email: session.user.email || "" }));
  }, [session]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Es sind nur Bilddateien zulässig (JPG, PNG, GIF, WEBP).");
    if (f.size > MAX) return setError("Die Datei überschreitet 5 MB. Bitte wählen Sie ein kleineres Bild.");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = session?.user?.email || form.email.trim();
    if (!f.validateAll({ titre: form.titre, description: form.description, email: form.email, url: form.url }, RULES)) return;
    setSending(true);
    let images: { url: string; name: string }[] = [];
    if (file) {
      const up = await uploadTicketImages([file]);
      if (!up.ok) {
        setSending(false);
        return setError(`Der Screenshot konnte nicht hochgeladen werden: ${up.error}`);
      }
      images = up.data.images;
    }
    const res = await createTicket({ ...form, email, images });
    setSending(false);
    if (!res.ok) {
      const byField = serverFieldErrors(res.details);
      if (Object.keys(byField).length) return f.setServerErrors(byField);
      return setError(res.status === 0 ? "Der Server antwortet nicht. Bitte versuchen Sie es gleich erneut." : res.error);
    }
    f.reset();
    setTicket(res.data.ticketNumber);
    setForm({ ...EMPTY, email: session?.user?.email || "", navigateur: detectBrowser() });
    setFile(null);
    setPreview("");
  };

  if (ticket) {
    return (
      <div className="flex flex-col items-start gap-5" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-paper">
          <IconCheck size={22} />
        </span>
        <p className="t-h3">
          Vielen Dank, Ihre Meldung <span className="t-spec !text-base">{ticket}</span> wurde erfasst.
        </p>
        <p className="text-graphite">Bitte notieren Sie diese Ticketnummer für eventuelle Rückfragen.</p>
        <button type="button" onClick={() => setTicket(null)} className="text-sm underline underline-offset-4">
          Weiteres Problem melden
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="mb-3 text-sm font-medium">Art der Meldung</legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Art der Meldung">
          {TYPES.map((t) => (
            <ChoiceCard key={t.value} name="type" checked={form.type === t.value} onChange={() => setForm((f) => ({ ...f, type: t.value }))} title={t.label} text={t.text} />
          ))}
        </div>
      </fieldset>
      <Field label="Titel" htmlFor="titre" required className="sm:col-span-2" error={f.errors.titre}>
        <Input id="titre" value={form.titre} onChange={(e) => (set("titre")(e), f.onChange("titre", e.target.value, RULES.titre))} {...bind("titre")} maxLength={200} placeholder="Kurze Zusammenfassung des Problems" />
      </Field>
      <Field label="Beschreibung" htmlFor="description" required className="sm:col-span-2" error={f.errors.description}>
        <Textarea id="description" value={form.description} onChange={(e) => (set("description")(e), f.onChange("description", e.target.value, RULES.description))} {...bind("description")} maxLength={2000} placeholder="Was haben Sie getan, was ist passiert, was haben Sie erwartet?" />
      </Field>
      {!session?.user && (
        <Field label="Ihre E-Mail-Adresse" htmlFor="email" required error={f.errors.email}>
          <Input id="email" type="email" value={form.email} onChange={(e) => (set("email")(e), f.onChange("email", e.target.value, RULES.email))} {...bind("email")} autoComplete="email" placeholder="name@beispiel.de" />
        </Field>
      )}
      <Field label="Priorität" htmlFor="priorite">
        <NativeSelect id="priorite" value={form.priorite} onChange={set("priorite")}>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Betroffene Seite" htmlFor="url" hint="Adresse der Internetseite (falls bekannt)" error={f.errors.url}>
        <Input id="url" type="url" value={form.url} onChange={(e) => (set("url")(e), f.onChange("url", e.target.value, RULES.url))} {...bind("url")} placeholder="https://…" />
      </Field>
      <Field label="Browser" htmlFor="navigateur">
        <Input id="navigateur" value={form.navigateur} onChange={set("navigateur")} />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-3 text-sm font-medium">
          Screenshot <span className="font-normal text-graphite">(optional, maximal 5 MB)</span>
        </p>
        {preview ? (
          <div className="relative inline-block border border-line p-2">
            <img src={preview} alt="Vorschau des ausgewählten Screenshots" className="max-h-48 max-w-full object-contain" />
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview("");
              }}
              className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-ink text-paper"
              aria-label="Screenshot entfernen"
            >
              <IconClose size={14} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-3 border border-dashed border-graphite-light px-6 py-8 text-sm transition-colors hover:border-ink focus-within:border-ink">
            <IconPlus size={18} /> Screenshot hinzufügen
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>
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
            "Meldung absenden"
          )}
        </Button>
      </div>
    </form>
  );
}

export default TicketForm;
