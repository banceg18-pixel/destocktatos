"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useError, useMessage } from "@/context/PopUpProvider";
import { deleteAddress, fetchAddresses, setDefaultAddress, type SavedAddress } from "@/services/account";
import { ButtonLink } from "@/components/ui/Button";
import { Spinner, Tag } from "@/components/ui/Primitives";
import { IconPlus } from "@/components/ui/Icons";
import { FLOOR_OPTIONS } from "./floors";

/** Carnet d'adresses de l'espace client : adresse par défaut, modification, suppression confirmée. */
export function AddressesSection({ initialAddresses }: { initialAddresses: SavedAddress[] }) {
  const { setMessage } = useMessage();
  const { setError } = useError();
  const errRef = useRef(setError);
  const [addresses, setAddresses] = useState(initialAddresses || []);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetchAddresses();
    if (res.ok) setAddresses(res.data.addresses || []);
    else errRef.current("Ihre Adressen konnten nicht neu geladen werden.");
  }, []);

  const remove = async (id: string) => {
    setBusy(id);
    const res = await deleteAddress(id);
    setBusy(null);
    setConfirmId(null);
    if (!res.ok) return setError(res.error || "Die Adresse konnte nicht gelöscht werden.");
    setMessage("Adresse gelöscht.");
    await reload();
  };

  const makeDefault = async (id: string) => {
    setBusy(id);
    const res = await setDefaultAddress(id);
    setBusy(null);
    if (!res.ok) return setError(res.error || "Diese Adresse konnte nicht als Standardadresse festgelegt werden.");
    setMessage("Standardadresse aktualisiert.");
    await reload();
  };

  return (
    <section id="adresses" aria-labelledby="adresses-titre" className="scroll-mt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 id="adresses-titre" className="t-h3">
          Meine Adressen
        </h2>
        {addresses.length > 0 && addresses.length < 10 && (
          <Link href="/compte/ajouter-adresse" className="link-underline inline-flex items-center gap-2 text-sm">
            <IconPlus size={16} /> Adresse hinzufügen
          </Link>
        )}
      </div>
      {addresses.length === 0 ? (
        <div className="flex flex-col items-start gap-5 border border-dashed border-line p-8">
          <p className="text-graphite">Keine Adresse hinterlegt. Fügen Sie eine hinzu, um schneller zu bestellen.</p>
          <ButtonLink href="/compte/ajouter-adresse" variant="outline" icon={<IconPlus size={16} />}>
            Adresse hinzufügen
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a._id} className={a.isDefault ? "flex flex-col border border-ink p-5" : "flex flex-col border border-line p-5"}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{a.fullName}</p>
                {a.isDefault && <Tag tone="ink">Standard</Tag>}
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {a.address}
                <br />
                {a.postalCode} {a.city}
              </p>
              <p className="t-spec mt-2 text-graphite">
                {FLOOR_OPTIONS.find((f) => f.value === a.floor)?.short ?? "Erdgeschoss"} · {a.phone}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-sm">
                {confirmId === a._id ? (
                  <>
                    <span>Diese Adresse löschen?</span>
                    <button type="button" onClick={() => remove(a._id)} disabled={busy === a._id} className="font-medium text-danger underline underline-offset-4">
                      {busy === a._id ? <Spinner /> : "Löschen"}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="underline underline-offset-4">
                      Behalten
                    </button>
                  </>
                ) : (
                  <>
                    <Link href={`/compte/ajouter-adresse?edit=${a._id}`} className="underline-offset-4 hover:underline">
                      Bearbeiten
                    </Link>
                    {!a.isDefault && (
                      <button type="button" onClick={() => makeDefault(a._id)} disabled={busy === a._id} className="underline-offset-4 hover:underline">
                        {busy === a._id ? <Spinner /> : "Als Standard festlegen"}
                      </button>
                    )}
                    <button type="button" onClick={() => setConfirmId(a._id)} className="text-graphite underline-offset-4 hover:text-danger hover:underline">
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default AddressesSection;
