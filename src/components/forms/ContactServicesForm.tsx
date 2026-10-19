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
  { id: "matin", label: "Matin", hours: "9 h – 12 h" },
  { id: "apres-midi", label: "Après-midi", hours: "14 h – 17 h" },
  { id: "soire", label: "Soirée", hours: "17 h – 19 h" },
];
const EMPTY = { name: "", email: "", phone: "", address: "", product: "", date: "", timeSlot: "", notes: "" };
type Key = Exclude<keyof typeof EMPTY, "notes">;
const RULES: Record<Key, (v: string) => string | null> = {
  name: rules.name,
  email: rules.email,
  phone: rules.phone,
  address: rules.text("l'adresse d'installation (numéro, rue et ville)", 8),
  product: rules.text("l'appareil à installer (type, marque ou référence)", 3),
  date: rules.futureDate,
  timeSlot: rules.choice("un créneau horaire"),
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
      setSent(res.data.message || "Votre demande est enregistrée.");
      setForm(EMPTY);
      f.reset();
    } else if (Object.keys(serverFieldErrors(res.details)).length) f.setServerErrors(serverFieldErrors(res.details));
    else setError(res.status === 0 ? "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez." : res.error || "La demande n'a pas pu être envoyée.");
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-5" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-paper">
          <IconCheck size={22} />
        </span>
        <p className="t-h3">{sent}</p>
        <p className="text-graphite">Un technicien vous rappelle pour confirmer le créneau.</p>
        <button type="button" onClick={() => setSent(null)} className="text-sm underline underline-offset-4">
          Faire une autre demande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Nom" htmlFor="svc-name" required error={f.errors.name}>
        <Input id="svc-name" {...field("name")} autoComplete="name" placeholder="Prénom et nom" />
      </Field>
      <Field label="Email" htmlFor="svc-email" required error={f.errors.email}>
        <Input id="svc-email" type="email" {...field("email")} autoComplete="email" placeholder="nom@exemple.fr" />
      </Field>
      <Field label="Téléphone" htmlFor="svc-phone" required error={f.errors.phone}>
        <Input id="svc-phone" type="tel" {...field("phone")} autoComplete="tel" placeholder="06 12 34 56 78" />
      </Field>
      <Field label="Adresse d'installation" htmlFor="svc-address" required error={f.errors.address}>
        <Input id="svc-address" {...field("address")} autoComplete="street-address" placeholder="Numéro, rue, ville" />
      </Field>
      <Field label="Appareil à installer" htmlFor="svc-product" required className="sm:col-span-2" error={f.errors.product}>
        <Input id="svc-product" {...field("product")} placeholder="Type, marque ou référence" />
      </Field>
      <Field label="Date souhaitée" htmlFor="svc-date" required error={f.errors.date}>
        <Input id="svc-date" type="date" {...field("date")} min={todayIso()} />
      </Field>
      <fieldset className="sm:col-span-2" aria-describedby={f.errors.timeSlot ? "svc-slot-error" : undefined}>
        <legend className="mb-3 text-sm font-medium">
          Créneau <span className="text-graphite">*</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Créneau horaire">
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
      <Field label="Précisions" htmlFor="svc-notes" className="sm:col-span-2">
        <Textarea id="svc-notes" value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} placeholder="Étage, accès, raccordements existants…" />
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
            "Demander un rendez-vous"
          )}
        </Button>
      </div>
    </form>
  );
}

export default ContactServicesForm;
