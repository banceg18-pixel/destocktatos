"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { SortKey } from "@/types/catalog";
import { SORT_LABELS } from "@/lib/catalog/query";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { NativeSelect } from "@/components/ui/Primitives";
import { IconFilter } from "@/components/ui/Icons";

/** Tri : met à jour l'URL (retour en page 1), sans remonter en haut de page. */
export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="catalog-sort" className="t-eyebrow hidden text-graphite sm:block">
        Trier
      </label>
      <NativeSelect
        id="catalog-sort"
        value={value}
        aria-busy={pending}
        className="h-10 min-w-44 text-sm"
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          p.delete("page");
          if (e.target.value === "recent") p.delete("tri");
          else p.set("tri", e.target.value);
          const qs = p.toString();
          start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
        }}
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Filtres sur mobile : panneau du bas, mêmes filtres que la colonne de gauche sur ordinateur. */
export function MobileFilters({ children, activeCount, total }: { children: ReactNode; activeCount: number; total: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" plain onClick={() => setOpen(true)} className="lg:hidden" icon={<IconFilter size={16} />}>
        Filtrer{activeCount > 0 ? ` (${activeCount})` : ""}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title="Filtrer"
        closeLabel="Fermer les filtres"
        footer={
          <Button block size="lg" onClick={() => setOpen(false)}>
            Voir {total} produit{total > 1 ? "s" : ""}
          </Button>
        }
      >
        {/* Un clic sur un filtre change l'URL : le panneau se referme avec la navigation. */}
        <div className="px-6 py-6" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {children}
        </div>
      </Drawer>
    </>
  );
}
