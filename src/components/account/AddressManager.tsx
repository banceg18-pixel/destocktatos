"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useError, useMessage } from "@/context/PopUpProvider";
import { createAddress, fetchAddresses, updateAddress } from "@/services/account";
import { apiFetch } from "@/services/http";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, NativeSelect, Spinner } from "@/components/ui/Primitives";
import { rules, serverFieldErrors } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { FormError } from "@/components/auth/ConnexionForm";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { FLOOR_OPTIONS } from "./floors";

type AddressKey = "fullName" | "phone" | "address" | "postalCode" | "city";
const RULES: Record<AddressKey, (v: string) => string | null> = {
  fullName: rules.recipient,
  phone: rules.phone,
  address: rules.street,
  postalCode: rules.postalCode,
  city: rules.city,
};

const EMPTY = { id: "", fullName: "", address: "", postalCode: "", city: "", phone: "", additionalInfo: "", isDefault: false, floor: 0 };

/** Ajout ou modification (?edit=ID) d'une adresse : vérification par la Base Adresse Nationale avant enregistrement. */
export function AddressManager() {
  const router = useRouter();
  const { setMessage } = useMessage();
  const { setError } = useError();
  const errRef = useRef(setError);
  const editId = useSearchParams().get("edit");
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    fetchAddresses().then((res) => {
      if (!res.ok) {
        errRef.current("L'adresse à modifier n'a pas pu être chargée.");
        return setLoading(false);
      }
      const a = (res.data.addresses || []).find((x) => x._id === editId);
      if (a) setForm({ id: a._id, fullName: a.fullName || "", address: a.address || "", postalCode: a.postalCode || "", city: a.city || "", phone: a.phone || "", additionalInfo: a.additionalInfo || "", isDefault: !!a.isDefault, floor: a.floor || 0 });
      else setFormError("Cette adresse n'existe plus. Vous pouvez en créer une nouvelle.");
      setLoading(false);
    });
  }, [editId]);

  const f = useFieldErrors<AddressKey>({ fullName: "adr-fullName", phone: "adr-phone", address: "adr-address", postalCode: "adr-postalCode", city: "adr-city" });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : k === "floor" ? Number(e.target.value) : e.target.value;
    setForm((s) => ({ ...s, [k]: v }));
    if (k in RULES) f.onChange(k as AddressKey, String(v), RULES[k as AddressKey]);
    if (formError && ["address", "postalCode", "city"].includes(k)) setFormError(null);
  };
  const blur = (k: AddressKey) => () => f.onBlur(k, String(form[k] ?? ""), RULES[k]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!f.validateAll({ fullName: form.fullName, phone: form.phone, address: form.address, postalCode: form.postalCode, city: form.city }, RULES)) return;
    setSaving(true);
    const check = await apiFetch<{ valid: boolean; error?: string; normalizedAddress?: { address: string; postalCode: string; city: string } }>("/api/addresses/validate", {
      method: "POST",
      json: { address: form.address, postalCode: form.postalCode, city: form.city },
    });
    if (!check.ok || !check.data.valid) {
      setSaving(false);
      return setFormError((check.ok ? check.data.error : check.error) || "Cette adresse n'a pas été reconnue. Choisissez une suggestion dans la liste.");
    }
    const n = check.data.normalizedAddress;
    const payload = {
      fullName: form.fullName,
      address: n?.address ?? form.address,
      postalCode: n?.postalCode ?? form.postalCode,
      city: n?.city ?? form.city,
      phone: form.phone,
      additionalInfo: form.additionalInfo,
      isDefault: form.isDefault,
      floor: form.floor,
    };
    const res = form.id ? await updateAddress(form.id, payload) : await createAddress(payload);
    setSaving(false);
    if (!res.ok) {
      const byField = serverFieldErrors(res.details);
      return Object.keys(byField).length ? f.setServerErrors(byField) : setFormError(res.error || "L'adresse n'a pas pu être enregistrée.");
    }
    setMessage(form.id ? "Adresse modifiée." : "Adresse ajoutée.");
    router.push("/compte#adresses");
    router.refresh();
  };

  if (loading) {
    return (
      <p className="flex items-center gap-3 text-graphite" role="status">
        <Spinner /> Chargement de l&apos;adresse…
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-5 md:grid-cols-2">
      <Field label="Nom complet" htmlFor="adr-fullName" required error={f.errors.fullName}>
        <Input id="adr-fullName" value={form.fullName} onChange={set("fullName")} onBlur={blur("fullName")} invalid={!!f.errors.fullName} autoComplete="name" placeholder="Prénom et nom" />
      </Field>
      <Field label="Téléphone" htmlFor="adr-phone" required error={f.errors.phone}>
        <Input id="adr-phone" type="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} invalid={!!f.errors.phone} autoComplete="tel" placeholder="06 12 34 56 78" />
      </Field>
      <Field label="Adresse" htmlFor="adr-address" required className="md:col-span-2" error={f.errors.address}>
        <AddressAutocomplete
          id="adr-address"
          value={form.address}
          invalid={!!f.errors.address}
          onChange={(v) => {
            setForm((s) => ({ ...s, address: v }));
            f.onChange("address", v, RULES.address);
          }}
          onBlur={() => f.onBlur("address", form.address, RULES.address)}
          onAddressSelect={(sel) => {
            setForm((s) => ({ ...s, ...sel }));
            f.setServerErrors({ address: undefined, postalCode: undefined, city: undefined });
          }}
          placeholder="Commencez à taper, puis choisissez dans la liste"
        />
      </Field>
      <Field label="Code postal" htmlFor="adr-postalCode" required error={f.errors.postalCode}>
        <Input id="adr-postalCode" value={form.postalCode} onChange={set("postalCode")} onBlur={blur("postalCode")} invalid={!!f.errors.postalCode} autoComplete="postal-code" inputMode="numeric" maxLength={5} placeholder="78300" />
      </Field>
      <Field label="Ville" htmlFor="adr-city" required error={f.errors.city}>
        <Input id="adr-city" value={form.city} onChange={set("city")} onBlur={blur("city")} invalid={!!f.errors.city} autoComplete="address-level2" placeholder="Poissy" />
      </Field>
      <Field label="Étage" htmlFor="adr-floor">
        <NativeSelect id="adr-floor" value={form.floor} onChange={set("floor")}>
          {FLOOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.short}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Informations pour le livreur" htmlFor="adr-info">
        <Input id="adr-info" value={form.additionalInfo} onChange={set("additionalInfo")} placeholder="Code d'entrée, interphone…" />
      </Field>
      <Checkbox className="md:col-span-2" checked={form.isDefault} onChange={set("isDefault")} label="Utiliser comme adresse par défaut" />
      <div className="md:col-span-2">
        <FormError text={formError} />
      </div>
      <div className="flex flex-wrap items-center gap-5 md:col-span-2">
        <Button type="submit" size="lg" disabled={saving} plain={saving}>
          {saving ? (
            <>
              <Spinner /> Vérification…
            </>
          ) : form.id ? (
            "Enregistrer les modifications"
          ) : (
            "Ajouter l'adresse"
          )}
        </Button>
        <Link href="/compte#adresses" className="text-sm underline-offset-4 hover:underline">
          Annuler
        </Link>
      </div>
    </form>
  );
}

export default AddressManager;
