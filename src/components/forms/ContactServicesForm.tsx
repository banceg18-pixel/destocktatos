"use client";

import { useState } from "react";
import { sendServiceRequest } from "@/services/forms";
import { Button } from "@/components/ui/Button";
import { Field, Input, Spinner, Textarea } from "@/components/ui/Primitives";
import { IconCheck } from "@/components/ui/Icons";
import { FormError } from "@/components/auth/ConnexionForm";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { bindField, useFieldErrors } from "@/lib/client/use-field-errors";
import { ChoiceCard } from "@/components/cart/ShippingAddressForm";

export const TIME_SLOTS = [
  { id: "matin", label: "Vormittag", hours: "9:00 – 12:00 Uhr" },
  { id: "apres-midi", label: "Nachmittag", hours: "14:00 – 17:00 Uhr" },
  { id: "soire", label: "Abend", hours: "17:00 – 19:00 Uhr" },
];
const EMPTY = { name: "", email: "", phone: "", address: "", product: "", date: "", timeSlot: "", notes: "" };
type Key = Exclude<keyof typeof EMPTY, "notes">;
const RULES: Record<Key, (v: string) => string | null> = {
  name: rules.name,
  email: rules.email,
  phone: rules.phone,
  address: rules.text("die Installationsadresse (Straße, Hausnummer, PLZ und Ort)", 8),
  product: rules.text("das zu installierende Gerät (Art, Marke oder Modell)", 3),
  date: rules.futureDate,
  timeSlot: rules.choice("ein Zeitfenster"),
};

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

/** Demande de rendez-vous d'installation (page Services) : date, créneau, appareil concerné. */
export function ContactServicesForm() {
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const f = useFieldErrors<Key>({ name: "svc-name", email: "svc-email", phone: "svc-phone", address: "svc-address", product: "svc-product", date: "svc-date", timeSlot: "svc-slot-matin" });
  const field = (k: Key) => bindField(f, k, form[k], (v) => setForm((s) => ({ ...s, [k]: v })), RULES[k]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.validateAll(form, RULES)) return;
    setSending(true);
    const res = await sendServiceRequest(form);
    setSending(false);
    if (res.ok) {
      setSent(res.data.message || "Ihre Anfrage wurde erfolgreich aufgenommen.");
      setForm(EMPTY);
      f.reset();
    } else if (Object.keys(serverFieldErrors(res.details)).length) f.setServerErrors(serverFieldErrors(res.details));
    else setError(res.status === 0 ? "Der Server antwortet nicht. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut." : res.error || "Die Anfrage konnte nicht gesendet werden.");
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-5" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-paper">
          <IconCheck size={22} />
        </span>
        <p className="t-h3">{sent}</p>
        <p className="text-graphite">Ein Servicetechniker wird Sie kontaktieren, um den Termin zu bestätigen.</p>
        <button type="button" onClick={() => setSent(null)} className="text-sm underline underline-offset-4">
          Weitere Anfrage stellen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Name" htmlFor="svc-name" required error={f.errors.name}>
        <Input id="svc-name" {...field("name")} autoComplete="name" placeholder="Vor- und Nachname" />
      </Field>
      <Field label="E-Mail" htmlFor="svc-email" required error={f.errors.email}>
        <Input id="svc-email" type="email" {...field("email")} autoComplete="email" placeholder="name@beispiel.de" />
      </Field>
      <Field label="Telefonnummer" htmlFor="svc-phone" required error={f.errors.phone}>
        <Input id="svc-phone" type="tel" {...field("phone")} autoComplete="tel" placeholder="+49 30 1234567" />
      </Field>
      <Field label="Installationsadresse" htmlFor="svc-address" required error={f.errors.address}>
        <Input id="svc-address" {...field("address")} autoComplete="street-address" placeholder="Straße, Hausnummer, PLZ, Ort" />
      </Field>
      <Field label="Zu installierendes Gerät" htmlFor="svc-product" required className="sm:col-span-2" error={f.errors.product}>
        <Input id="svc-product" {...field("product")} placeholder="Gerätetyp, Marke oder Modell" />
      </Field>
      <Field label="Wunschtermin" htmlFor="svc-date" required error={f.errors.date}>
        <Input id="svc-date" type="date" {...field("date")} min={todayIso()} />
      </Field>
      <fieldset className="sm:col-span-2" aria-describedby={f.errors.timeSlot ? "svc-slot-error" : undefined}>
        <legend className="mb-3 text-sm font-medium">
          Zeitfenster <span className="text-graphite">*</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Zeitfenster">
          {TIME_SLOTS.map((s) => (
            <ChoiceCard
              key={s.id}
              id={`svc-slot-${s.id}`}
              name="creneau"
              checked={form.timeSlot === s.id}
              onChange={() => {
                setForm((v) => ({ ...v, timeSlot: s.id }));
                f.onChange("timeSlot", s.id, RULES.timeSlot);
              }}
              title={s.label}
              text={s.hours}
            />
          ))}
        </div>
        {f.errors.timeSlot && (
          <p id="svc-slot-error" role="alert" className="mt-2 text-sm text-danger">
            {f.errors.timeSlot}
          </p>
        )}
      </fieldset>
      <Field label="Hinweise & Details" htmlFor="svc-notes" className="sm:col-span-2">
        <Textarea id="svc-notes" value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} placeholder="Etage, Zugänglichkeit, vorhandene Anschlüsse…" />
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
            "Termin anfragen"
          )}
        </Button>
      </div>
    </form>
  );
}

export default ContactServicesForm;
