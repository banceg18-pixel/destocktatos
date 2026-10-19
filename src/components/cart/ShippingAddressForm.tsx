"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useCart, type ShippingAddress } from "@/context/CartProvider";
import { useError, useMessage } from "@/context/PopUpProvider";
import type { SiteSettings } from "@/lib/cms/types";
import { AddressAutocomplete } from "@/components/account/AddressAutocomplete";
import { FLOOR_OPTIONS } from "@/components/account/floors";
import { createAddress, fetchAddresses, type SavedAddress } from "@/services/account";
import { geocodeAddress } from "@/lib/geocode";
import { LONG_DISTANCE_THRESHOLD, MAX_DELIVERY_DISTANCE, STORE_COORDINATES, calculateDistance } from "@/lib/delivery";
import { cn } from "@/lib/client/cn";
import { Field, Input, NativeSelect, Spinner, Textarea } from "@/components/ui/Primitives";
import { IconAlert, IconCheck, IconPin, IconStore, IconTruck } from "@/components/ui/Icons";
import { rules } from "@/lib/client/form-rules";

const EMPTY: ShippingAddress = { _id: "", fullName: "", address: "", city: "", postalCode: "", phone: "", additionalInfo: "", isDefault: false, floor: 0 };

type AddressKey = "fullName" | "phone" | "address" | "postalCode" | "city";
const ADDRESS_RULES: Record<AddressKey, (v: string) => string | null> = {
  fullName: rules.recipient,
  phone: (v) => (v.trim() ? rules.phone(v) : "Indiquez un téléphone : le livreur vous appelle avant de passer."),
  address: rules.street,
  postalCode: rules.postalCode,
  city: rules.city,
};

function validate(a: ShippingAddress) {
  const e: Partial<Record<AddressKey, string>> = {};
  for (const k of Object.keys(ADDRESS_RULES) as AddressKey[]) {
    const msg = ADDRESS_RULES[k](String(a[k] ?? ""));
    if (msg) e[k] = msg;
  }
  return e;
}

/** Carte de choix radio (vrai bouton radio : clavier et lecteurs d'écran). */
export function ChoiceCard({
  id,
  name,
  checked,
  onChange,
  disabled,
  title,
  text,
  aside,
  icon,
}: {
  id?: string;
  name: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title: React.ReactNode;
  text?: React.ReactNode;
  aside?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-4 border p-5 transition-colors",
        checked ? "border-ink bg-mist" : "border-line hover:border-graphite-light",
        disabled && "cursor-not-allowed opacity-45 hover:border-line",
      )}
    >
      <input type="radio" id={id} name={name} checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink", checked ? "border-ink" : "border-graphite-light")}
      >
        {checked && <span className="size-2.5 rounded-full bg-ink" />}
      </span>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium">{title}</span>
        {text && <span className="text-sm text-graphite">{text}</span>}
      </span>
      {aside && <span className="t-price shrink-0 text-right text-sm font-medium">{aside}</span>}
    </label>
  );
}

/** Réception de la commande : retrait en magasin ou livraison (adresses enregistrées, saisie, distance). */
export function ShippingAddressForm({ settings }: { settings: SiteSettings }) {
  const { shippingAddress, setShippingAddress, isPickupInStore, setIsPickupInStore, isShippingAddressValid, setDeliveryDistance, deliveryDistance, resetDeliveryMethod } = useCart();
  const { setError } = useError();
  const { setMessage } = useMessage();
  const { data: session } = useSession();
  const errRef = useRef(setError);
  const lastKey = useRef("");
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Champs déjà quittés (ou « all » après une tentative d'enregistrement) : seuls eux affichent leur erreur.
  const [touched, setTouched] = useState<Set<AddressKey> | "all">(() => new Set());
  const touch = (k: AddressKey) => setTouched((t) => (t === "all" || t.has(k) ? t : new Set([...t, k])));
  const [form, setForm] = useState<ShippingAddress>(EMPTY);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const initialized = useRef(false);
  const updating = useRef(false);

  const errors = useMemo(() => {
    const all = validate(form);
    if (touched === "all") return all;
    return Object.fromEntries(Object.entries(all).filter(([k]) => touched.has(k as AddressKey))) as typeof all;
  }, [touched, form]);
  const complete = useMemo(() => isPickupInStore || isShippingAddressValid(), [isPickupInStore, isShippingAddressValid]);

  const computeDistance = useCallback(
    async (address: string, city: string, postalCode: string) => {
      if (!address?.trim() || !city?.trim() || !postalCode?.trim()) return;
      const key = `${address.trim()}-${city.trim()}-${postalCode.trim()}`;
      if (lastKey.current === key) return;
      lastKey.current = key;
      setGeocoding(true);
      setGeoError(null);
      try {
        const coords = await geocodeAddress(address, city, postalCode);
        if (coords) {
          setDeliveryDistance(calculateDistance(coords.lat, coords.lng, STORE_COORDINATES.lat, STORE_COORDINATES.lng) || 1);
        } else {
          setDeliveryDistance(0);
          setGeoError(`Nous ne trouvons pas « ${address}, ${postalCode} ${city} ». Vérifiez l'orthographe ou choisissez une suggestion dans la liste.`);
        }
      } catch {
        setDeliveryDistance(0);
        setGeoError("Le calcul de distance n'a pas abouti. Vérifiez votre connexion puis réessayez.");
      } finally {
        setGeocoding(false);
      }
    },
    [setDeliveryDistance],
  );

  // Adresses enregistrées du client connecté (présélection de l'adresse par défaut).
  useEffect(() => {
    if (!session?.user?.email || loaded) return;
    setLoaded(true);
    (async () => {
      const res = await fetchAddresses();
      if (!res.ok) return errRef.current("Vos adresses enregistrées n'ont pas pu être chargées.");
      const list = res.data.addresses || [];
      setSaved(list);
      if (!selectedId && !shippingAddress && list.length > 0) {
        const def = list.find((a) => a.isDefault) ?? list[0];
        setSelectedId(def._id);
        setForm(def);
        setShippingAddress(def);
        computeDistance(def.address, def.city, def.postalCode);
      }
      setShowForm(list.length === 0);
    })();
  }, [session?.user?.email, loaded, selectedId, shippingAddress, setShippingAddress, computeDistance]);

  useEffect(() => {
    if (isPickupInStore) {
      setShippingAddress(null);
      setDeliveryDistance(0);
      setGeoError(null);
    }
  }, [isPickupInStore, setShippingAddress, setDeliveryDistance]);

  useEffect(() => {
    if (!initialized.current && shippingAddress && !selectedId && !form.address) {
      setForm(shippingAddress);
      initialized.current = true;
    }
  }, [shippingAddress, selectedId, form.address]);

  const applyAddress = (a: ShippingAddress) => {
    if (updating.current || isPickupInStore || Object.keys(validate(a)).length > 0) return;
    updating.current = true;
    setShippingAddress(a);
    computeDistance(a.address, a.city, a.postalCode);
    setTimeout(() => (updating.current = false), 100);
  };

  const switchMode = (mode: "delivery" | "pickup") => {
    setTouched(new Set());
    if (mode === "pickup") {
      setIsPickupInStore(true);
      setGeoError(null);
      setDeliveryDistance(0);
      resetDeliveryMethod();
    } else {
      setIsPickupInStore(false);
      if (Object.keys(validate(form)).length === 0) applyAddress(form);
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: name === "floor" ? parseInt(value) : value };
    setForm(next);
    if (selectedId) setSelectedId(null);
    if (["address", "city", "postalCode"].includes(name) && geoError) setGeoError(null);
    // L'adresse est appliquée dès qu'elle est complète et valide (le calcul de distance suit).
    if (Object.keys(validate(next)).length === 0) applyAddress(next);
    else if (name === "floor" && shippingAddress) setShippingAddress({ ...shippingAddress, floor: next.floor });
  };

  const save = async () => {
    if (!session?.user?.email) return;
    setTouched("all");
    if (Object.keys(validate(form)).length > 0) return;
    setSaving(true);
    const { _id, ...payload } = form;
    void _id;
    const res = await createAddress({ ...payload, isDefault: saved.length === 0 });
    setSaving(false);
    if (!res.ok) return setError(res.error || "L'adresse n'a pas pu être enregistrée.");
    setMessage("Adresse enregistrée dans votre carnet.");
    const a = { ...form, _id: res.data.address._id, isDefault: saved.length === 0 };
    setForm(a);
    setSelectedId(res.data.address._id);
    applyAddress(a);
    setSaved((list) => [...list.filter((x) => x._id !== a._id), a as SavedAddress]);
    setShowForm(false);
  };

  const formVisible = showForm || saved.length === 0 || !session?.user;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Mode de réception">
        <ChoiceCard name="reception" checked={!isPickupInStore} onChange={() => switchMode("delivery")} icon={<IconTruck />} title="Livraison à domicile" text={`Jusqu'à ${MAX_DELIVERY_DISTANCE} km, tarif selon la distance`} />
        <ChoiceCard name="reception" checked={isPickupInStore} onChange={() => switchMode("pickup")} icon={<IconStore />} title="Retrait en magasin" text="Gratuit, prêt sous 24 h" aside="Gratuit" />
      </div>

      {isPickupInStore ? (
        <div className="flex gap-4 bg-mist p-5">
          <IconPin className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">
              {settings.siteName} — {settings.addressLine}, {settings.postalCode} {settings.city}
            </p>
            <p className="mt-1 text-graphite">{settings.storeHours}</p>
            <p className="mt-3 text-graphite">Nous vous prévenons dès que la commande est prête. Munissez-vous d&apos;une pièce d&apos;identité.</p>
          </div>
        </div>
      ) : (
        <>
          {session?.user && saved.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Mes adresses</p>
                <button type="button" onClick={() => setShowForm((v) => !v)} className="text-sm underline underline-offset-4">
                  {showForm ? "Masquer le formulaire" : "Utiliser une autre adresse"}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Adresses enregistrées">
                {saved.map((a) => (
                  <ChoiceCard
                    key={a._id}
                    name="adresse"
                    checked={selectedId === a._id}
                    onChange={() => {
                      setSelectedId(a._id);
                      setForm(a);
                      setShowForm(false);
                      setTouched(new Set());
                      setTimeout(() => applyAddress(a), 50);
                    }}
                    title={a.fullName}
                    text={
                      <>
                        {a.address}, {a.postalCode} {a.city}
                        <br />
                        {FLOOR_OPTIONS.find((f) => f.value === a.floor)?.short ?? "Rez-de-chaussée"} · {a.phone}
                      </>
                    }
                    aside={a.isDefault ? <span className="t-spec text-graphite">Par défaut</span> : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {formVisible && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              noValidate
              className="grid gap-5 md:grid-cols-2"
            >
              <Field label="Nom complet" htmlFor="ship-fullName" required error={errors.fullName}>
                <Input id="ship-fullName" name="fullName" value={form.fullName} onChange={onInput} onBlur={() => touch("fullName")} invalid={!!errors.fullName} placeholder="Prénom et nom" autoComplete="name" />
              </Field>
              <Field label="Téléphone" htmlFor="ship-phone" required error={errors.phone} hint="Le livreur vous appelle avant de passer.">
                <Input id="ship-phone" type="tel" name="phone" value={form.phone} onChange={onInput} onBlur={() => touch("phone")} invalid={!!errors.phone} placeholder="06 12 34 56 78" autoComplete="tel" />
              </Field>
              <Field label="Adresse" htmlFor="ship-address" required error={errors.address} className="md:col-span-2">
                <AddressAutocomplete
                  id="ship-address"
                  value={form.address}
                  invalid={!!errors.address}
                  onBlur={() => touch("address")}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  onAddressSelect={(sel) => {
                    const next = { ...form, address: sel.address, postalCode: sel.postalCode, city: sel.city };
                    setForm(next);
                    if (selectedId) setSelectedId(null);
                    if (geoError) setGeoError(null);
                    setTimeout(() => applyAddress(next), 100);
                  }}
                  placeholder="Commencez à taper, puis choisissez dans la liste"
                />
              </Field>
              <Field label="Code postal" htmlFor="ship-postalCode" required error={errors.postalCode}>
                <Input id="ship-postalCode" name="postalCode" value={form.postalCode} onChange={onInput} onBlur={() => touch("postalCode")} invalid={!!errors.postalCode} placeholder="93270" maxLength={5} autoComplete="postal-code" inputMode="numeric" />
              </Field>
              <Field label="Ville" htmlFor="ship-city" required error={errors.city}>
                <Input id="ship-city" name="city" value={form.city} onChange={onInput} onBlur={() => touch("city")} invalid={!!errors.city} placeholder="Sevran" autoComplete="address-level2" />
              </Field>
              <Field label="Étage" htmlFor="ship-floor" hint="Frais d'étage dès le 3ᵉ, sans ascenseur comme avec.">
                <NativeSelect id="ship-floor" name="floor" value={form.floor} onChange={onInput}>
                  {FLOOR_OPTIONS.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.short}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Informations pour le livreur" htmlFor="ship-info">
                <Textarea id="ship-info" name="additionalInfo" value={form.additionalInfo} onChange={onInput} placeholder="Code d'entrée, interphone, accès…" className="!min-h-12" rows={1} />
              </Field>
              {session?.user && (
                <div className="md:col-span-2">
                  <button type="submit" disabled={saving} className="text-sm underline underline-offset-4 disabled:opacity-50">
                    {saving ? "Enregistrement…" : "Enregistrer cette adresse dans mon compte"}
                  </button>
                </div>
              )}
            </form>
          )}

          <div aria-live="polite">
            {geocoding && (
              <p className="flex items-center gap-3 text-sm text-graphite">
                <Spinner /> Calcul de la distance depuis le magasin…
              </p>
            )}
            {geoError && (
              <div className="flex gap-3 border border-danger/30 bg-danger/5 p-4 text-sm" role="alert">
                <IconAlert className="mt-0.5 shrink-0 text-danger" />
                <div>
                  <p>{geoError}</p>
                  {form.address && form.city && form.postalCode && (
                    <button
                      type="button"
                      className="mt-2 font-medium underline underline-offset-4"
                      onClick={() => {
                        setGeoError(null);
                        lastKey.current = "";
                        computeDistance(form.address, form.city, form.postalCode);
                      }}
                    >
                      Relancer le calcul
                    </button>
                  )}
                </div>
              </div>
            )}
            {!geocoding && !geoError && deliveryDistance > 0 && (
              <div className={cn("flex gap-3 p-4 text-sm", deliveryDistance > MAX_DELIVERY_DISTANCE ? "border border-danger/30 bg-danger/5" : "bg-mist")}>
                <IconPin className="mt-0.5 shrink-0" />
                <div>
                  <p>
                    Adresse à <strong className="t-price">{deliveryDistance} km</strong> du magasin.
                  </p>
                  {deliveryDistance > MAX_DELIVERY_DISTANCE ? (
                    <p className="mt-1 text-danger">Nous ne livrons pas au-delà de {MAX_DELIVERY_DISTANCE} km. Choisissez le retrait en magasin ou une adresse plus proche.</p>
                  ) : deliveryDistance > LONG_DISTANCE_THRESHOLD ? (
                    <p className="mt-1 text-graphite">Au-delà de {LONG_DISTANCE_THRESHOLD} km, seule la livraison au pied du camion est proposée.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <p className={cn("flex items-center gap-2 text-sm", complete ? "text-success" : "text-graphite")} role="status">
        {complete ? <IconCheck size={16} /> : <IconAlert size={16} />}
        <span>{complete ? (isPickupInStore ? "Retrait en magasin sélectionné" : "Adresse de livraison complète") : "Complétez l'adresse de livraison ou choisissez le retrait en magasin"}</span>
      </p>
    </div>
  );
}

export default ShippingAddressForm;
