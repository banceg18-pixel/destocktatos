"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Product } from "@/types/catalog";
import { searchProducts } from "@/services/products";
import { debounce } from "@/lib/client/debounce";
import { Drawer } from "@/components/ui/Drawer";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { Arrow, Price, Spinner } from "@/components/ui/Primitives";
import { IconSearch } from "@/components/ui/Icons";

const SUGGESTIONS = ["Lave-linge", "Réfrigérateur", "Plaque induction", "Micro-ondes", "Aspirateur", "Lave-vaisselle"];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Recherche instantanée : résultats dès 2 caractères, Entrée ouvre la liste complète en boutique. */
export function SearchPanel({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: Category[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const latest = useRef("");

  const run = useMemo(
    () =>
      debounce(async (term: string) => {
        latest.current = term;
        const res = await searchProducts(term, 8);
        if (latest.current !== term) return; // une frappe plus récente a pris le relais
        if (res.ok) {
          setResults(res.data.produits ?? []);
          setState("done");
        } else setState("error");
      }, 250),
    [],
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      latest.current = "";
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    run(term);
  }, [q, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    onClose();
    router.push(`/boutique?recherche=${encodeURIComponent(term)}`);
  };

  return (
    <Drawer open={open} onClose={onClose} side="top" title="Rechercher" closeLabel="Fermer la recherche">
      <div className="shell py-8 lg:py-12">
        <form role="search" onSubmit={submit} className="flex items-center gap-4 border-b border-ink pb-4">
          <IconSearch size={26} className="shrink-0" />
          <label htmlFor="site-search" className="sr-only">
            Rechercher un produit
          </label>
          <input
            id="site-search"
            data-autofocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un appareil, une marque, une référence…"
            autoComplete="off"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent font-display text-[clamp(1.4rem,3.2vw,2.6rem)] tracking-tight [font-stretch:110%] placeholder:text-graphite-light focus:outline-none"
          />
          {state === "loading" && <Spinner />}
        </form>

        <div className="mt-8 min-h-40" aria-live="polite">
          {state === "idle" && (
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <p className="t-eyebrow mb-4 text-graphite">Recherches fréquentes</p>
                <ul className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => setQ(s)} className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-ink">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="t-eyebrow mb-4 text-graphite">Catégories</p>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                  {categories.slice(0, 12).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/categorie/${c.slug}`} onClick={onClose} className="link-underline text-sm">
                        {capitalize(c.nom)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {state === "error" && <p className="text-danger">La recherche est momentanément indisponible. Réessayez dans un instant.</p>}

          {state === "done" && results.length === 0 && (
            <p className="text-lg">
              Aucun produit ne correspond à « {q.trim()} ». Essayez une marque, un type d&apos;appareil ou une référence.
            </p>
          )}

          {results.length > 0 && state !== "idle" && (
            <>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {results.map((p) => (
                  <li key={p._id}>
                    <Link href={`/boutique/${p.slug}`} onClick={onClose} className="group block">
                      <div className="aspect-square overflow-hidden bg-mist p-6">
                        <ImageComponent
                          img={p.imagePrincipale?.url}
                          alt={p.titre}
                          size={320}
                          sizes="(min-width: 1024px) 22vw, 45vw"
                          className="size-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>
                      <p className="t-spec mt-3 text-graphite">
                        {p.marque} · {p.modele}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium">{p.titre}</p>
                      <Price prix={p.prix} promotionPrix={p.promotionPrix} size="sm" className="mt-1" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/boutique?recherche=${encodeURIComponent(q.trim())}`} onClick={onClose} className="t-eyebrow link-underline mt-10 inline-flex items-center gap-2">
                Voir tous les résultats pour « {q.trim()} » <Arrow />
              </Link>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
