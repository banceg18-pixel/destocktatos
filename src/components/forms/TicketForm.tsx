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
  { value: "bug", label: "Un problème", text: "Quelque chose ne fonctionne pas" },
  { value: "amelioration", label: "Une amélioration", text: "Rendre une page plus pratique" },
  { value: "fonctionnalite", label: "Une idée", text: "Une fonction qui manque" },
];
const PRIORITIES = [
  { value: "basse", label: "Basse — gêne mineure" },
  { value: "normale", label: "Normale" },
  { value: "haute", label: "Haute — gêne importante" },
  { value: "critique", label: "Critique — impossible de commander" },
];
const EMPTY = { titre: "", description: "", type: "bug", priorite: "normale", email: "", navigateur: "", url: "" };
const MAX = 5 * 1024 * 1024;

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return "Autre";
}

/** Signaler un problème sur le site (ticket d'assistance avec capture d'écran facultative). */
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
    titre: rules.text("un titre qui résume le problème", 5),
    description: rules.text("la description (ce que vous faisiez et ce qui s'est passé)", 15),
    email: session?.user ? () => null : rules.email,
    url: rules.optional((v: string) => (/^https?:\/\/\S+$/.test(v.trim()) ? null : "Adresse de page invalide : elle doit commencer par https:// (ou laissez le champ vide).")),
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
    if (!f.type.startsWith("image/")) return setError("Seules les images sont acceptées (JPG, PNG, GIF, WEBP).");
    if (f.size > MAX) return setError("Le fichier dépasse 5 Mo. Choisissez une capture plus légère.");
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
        return setError(`La capture n'a pas pu être envoyée : ${up.error}`);
      }
      images = up.data.images;
    }
    const res = await createTicket({ ...form, email, images });
    setSending(false);
    if (!res.ok) {
      const byField = serverFieldErrors(res.details);
      if (Object.keys(byField).length) return f.setServerErrors(byField);
      return setError(res.status === 0 ? "Le serveur ne répond pas. Réessayez dans un instant." : res.error);
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
          Merci, votre signalement <span className="t-spec !text-base">{ticket}</span> est enregistré.
        </p>
        <p className="text-graphite">Notez ce numéro : il vous sera demandé si nous vous recontactons.</p>
        <button type="button" onClick={() => setTicket(null)} className="text-sm underline underline-offset-4">
          Signaler autre chose
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="mb-3 text-sm font-medium">Vous nous signalez</legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Type de signalement">
          {TYPES.map((t) => (
            <ChoiceCard key={t.value} name="type" checked={form.type === t.value} onChange={() => setForm((f) => ({ ...f, type: t.value }))} title={t.label} text={t.text} />
          ))}
        </div>
      </fieldset>
      <Field label="Titre" htmlFor="titre" required className="sm:col-span-2" error={f.errors.titre}>
        <Input id="titre" value={form.titre} onChange={(e) => (set("titre")(e), f.onChange("titre", e.target.value, RULES.titre))} {...bind("titre")} maxLength={200} placeholder="En quelques mots" />
      </Field>
      <Field label="Description" htmlFor="description" required className="sm:col-span-2" error={f.errors.description}>
        <Textarea id="description" value={form.description} onChange={(e) => (set("description")(e), f.onChange("description", e.target.value, RULES.description))} {...bind("description")} maxLength={2000} placeholder="Ce que vous faisiez, ce qui s'est passé, ce que vous attendiez." />
      </Field>
      {!session?.user && (
        <Field label="Votre email" htmlFor="email" required error={f.errors.email}>
          <Input id="email" type="email" value={form.email} onChange={(e) => (set("email")(e), f.onChange("email", e.target.value, RULES.email))} {...bind("email")} autoComplete="email" placeholder="nom@exemple.fr" />
        </Field>
      )}
      <Field label="Priorité" htmlFor="priorite">
        <NativeSelect id="priorite" value={form.priorite} onChange={set("priorite")}>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Page concernée" htmlFor="url" hint="Adresse de la page, si vous la connaissez." error={f.errors.url}>
        <Input id="url" type="url" value={form.url} onChange={(e) => (set("url")(e), f.onChange("url", e.target.value, RULES.url))} {...bind("url")} placeholder="https://…" />
      </Field>
      <Field label="Navigateur" htmlFor="navigateur">
        <Input id="navigateur" value={form.navigateur} onChange={set("navigateur")} />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-3 text-sm font-medium">
          Capture d&apos;écran <span className="font-normal text-graphite">(facultatif, 5 Mo maximum)</span>
        </p>
        {preview ? (
          <div className="relative inline-block border border-line p-2">
            <img src={preview} alt="Aperçu de la capture choisie" className="max-h-48 max-w-full object-contain" />
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview("");
              }}
              className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-ink text-paper"
              aria-label="Retirer la capture"
            >
              <IconClose size={14} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-3 border border-dashed border-graphite-light px-6 py-8 text-sm transition-colors hover:border-ink focus-within:border-ink">
            <IconPlus size={18} /> Ajouter une capture
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
              <Spinner /> Envoi…
            </>
          ) : (
            "Envoyer le signalement"
          )}
        </Button>
      </div>
    </form>
  );
}

export default TicketForm;
