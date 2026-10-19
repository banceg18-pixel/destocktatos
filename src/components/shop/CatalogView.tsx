import Link from "next/link";
import type { Category, Product } from "@/types/catalog";
import { catalogHref, PRICE_RANGES, type CatalogQuery } from "@/lib/catalog/query";
import { PRICE_MAX_DEFAULT } from "@/lib/catalog/constants";
import { cn } from "@/lib/client/cn";
import { formatEuros } from "@/lib/money";
import { ProductCard } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { IconClose } from "@/components/ui/Icons";
import { MobileFilters, SortSelect } from "./CatalogControls";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  basePath: string;
  query: CatalogQuery;
  products: Product[];
  total: number;
  totalPages: number;
  categories: Category[];
  /** Page catégorie : la catégorie est imposée par l'URL et n'apparaît pas dans les filtres. */
  lockedCategory?: Category;
  sousCategories: Record<string, string[]>;
}

function FilterLink({ href, active, children, count }: { href: string; active: boolean; children: React.ReactNode; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn("group flex items-center justify-between gap-3 py-1.5 text-[0.95rem] transition-colors", active ? "font-medium text-ink" : "text-ink-soft hover:text-ink")}
    >
      <span className="flex items-center gap-3">
        <span className={cn("size-3.5 shrink-0 rounded-full border transition-colors", active ? "border-ink bg-ink" : "border-graphite-light group-hover:border-ink")} aria-hidden="true" />
        {children}
      </span>
      {count != null && <span className="t-spec text-graphite">{count}</span>}
    </Link>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <legend className="t-eyebrow mb-4 text-graphite">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Panneau de filtres (liens et formulaire GET : fonctionne aussi sans JavaScript). */
function FilterPanel({ basePath, query: q, categories, lockedCategory, sousCategories }: Omit<Props, "products" | "total" | "totalPages">) {
  const activeCat = lockedCategory?.nom ?? q.categorie;
  const types = activeCat ? (sousCategories[activeCat] ?? []) : [];
  return (
    <div>
      {!lockedCategory && (
        <FilterGroup title="Catégorie">
          <FilterLink href={catalogHref(basePath, q, { categorie: "", sousCategorie: "" })} active={!q.categorie}>
            Toutes les catégories
          </FilterLink>
          {categories
            .filter((c) => (c.count ?? 0) > 0)
            .map((c) => (
              <FilterLink key={c.slug} href={catalogHref(basePath, q, { categorie: c.nom, sousCategorie: "" })} active={q.categorie === c.nom} count={c.count}>
                {capitalize(c.nom)}
              </FilterLink>
            ))}
        </FilterGroup>
      )}

      {types.length > 0 && (
        <FilterGroup title="Type">
          <FilterLink href={catalogHref(basePath, q, { sousCategorie: "" })} active={!q.sousCategorie}>
            Tous les types
          </FilterLink>
          {types.map((t) => (
            <FilterLink key={t} href={catalogHref(basePath, q, { sousCategorie: t })} active={q.sousCategorie === t.toLowerCase()}>
              {capitalize(t)}
            </FilterLink>
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Prix">
        {PRICE_RANGES.map((r) => (
          <FilterLink key={r.label} href={catalogHref(basePath, q, { prixMin: r.min, prixMax: r.max })} active={q.prixMin === r.min && q.prixMax === r.max}>
            {r.label}
          </FilterLink>
        ))}
        <form action={basePath} method="get" className="mt-4 flex items-end gap-2">
          {q.recherche && <input type="hidden" name="recherche" value={q.recherche} />}
          {q.categorie && !lockedCategory && <input type="hidden" name="categorie" value={q.categorie} />}
          {q.sousCategorie && <input type="hidden" name="sousCategorie" value={q.sousCategorie} />}
          {q.promotions && <input type="hidden" name="promotions" value="1" />}
          {q.tri !== "recent" && <input type="hidden" name="tri" value={q.tri} />}
          <label className="flex-1 text-xs text-graphite">
            Min (€)
            <input name="prixMin" type="number" min={0} step={10} defaultValue={q.prixMin || ""} placeholder="0" className="mt-1 h-10 w-full rounded-sm border border-line px-3 text-sm text-ink focus:border-ink focus:outline-none" />
          </label>
          <label className="flex-1 text-xs text-graphite">
            Max (€)
            <input
              name="prixMax"
              type="number"
              min={0}
              step={10}
              defaultValue={q.prixMax < PRICE_MAX_DEFAULT ? q.prixMax : ""}
              placeholder="5 000"
              className="mt-1 h-10 w-full rounded-sm border border-line px-3 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-ink text-paper hover:bg-ink-soft" aria-label="Appliquer la fourchette de prix">
            <Arrow />
          </button>
        </form>
      </FilterGroup>

      <FilterGroup title="Offres">
        <FilterLink href={catalogHref(basePath, q, { promotions: !q.promotions })} active={q.promotions}>
          Promotions uniquement
        </FilterLink>
      </FilterGroup>
    </div>
  );
}

function Pagination({ basePath, query, totalPages }: { basePath: string; query: CatalogQuery; totalPages: number }) {
  if (totalPages <= 1) return null;
  const cur = query.page;
  const pages = new Set([1, totalPages, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= totalPages));
  const list = [...pages].sort((a, b) => a - b);
  const cell = "flex h-11 min-w-11 items-center justify-center rounded-sm border px-3 text-sm transition-colors";
  return (
    <nav aria-label="Pagination" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {cur > 1 ? (
        <Link href={catalogHref(basePath, query, { page: cur - 1 })} className={cn(cell, "border-line hover:border-ink")} aria-label="Page précédente">
          <Arrow direction="left" />
        </Link>
      ) : (
        <span className={cn(cell, "border-line opacity-30")} aria-hidden="true">
          <Arrow direction="left" />
        </span>
      )}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && list[i - 1] !== p - 1 && <span className="px-1 text-graphite">…</span>}
          <Link
            href={catalogHref(basePath, query, { page: p })}
            aria-current={p === cur ? "page" : undefined}
            className={cn(cell, "t-price", p === cur ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}
          >
            {p}
          </Link>
        </span>
      ))}
      {cur < totalPages ? (
        <Link href={catalogHref(basePath, query, { page: cur + 1 })} className={cn(cell, "border-line hover:border-ink")} aria-label="Page suivante">
          <Arrow />
        </Link>
      ) : (
        <span className={cn(cell, "border-line opacity-30")} aria-hidden="true">
          <Arrow />
        </span>
      )}
    </nav>
  );
}

/** Vue catalogue commune (boutique, catégories, recherche) : filtres, tri, grille, pagination. */
export function CatalogView(props: Props) {
  const { basePath, query: q, products, total, totalPages, lockedCategory } = props;
  const chips: { label: string; href: string }[] = [];
  if (q.recherche) chips.push({ label: `« ${q.recherche} »`, href: catalogHref(basePath, q, { recherche: "" }) });
  if (q.categorie && !lockedCategory) chips.push({ label: capitalize(q.categorie), href: catalogHref(basePath, q, { categorie: "", sousCategorie: "" }) });
  if (q.sousCategorie) chips.push({ label: capitalize(q.sousCategorie), href: catalogHref(basePath, q, { sousCategorie: "" }) });
  if (q.prixMin > 0 || q.prixMax < PRICE_MAX_DEFAULT)
    chips.push({
      label: q.prixMax < PRICE_MAX_DEFAULT ? `${formatEuros(q.prixMin)} – ${formatEuros(q.prixMax)}` : `Dès ${formatEuros(q.prixMin)}`,
      href: catalogHref(basePath, q, { prixMin: 0, prixMax: PRICE_MAX_DEFAULT }),
    });
  if (q.promotions) chips.push({ label: "Promotions", href: catalogHref(basePath, q, { promotions: false }) });
  const reset = lockedCategory ? basePath : "/boutique";
  const panel = <FilterPanel {...props} />;

  return (
    <div className="shell grid gap-10 pb-24 lg:grid-cols-[250px_1fr] lg:gap-14">
      <aside className="hidden lg:block" aria-label="Filtres">
        <div className="pb-6">{panel}</div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <p className="t-spec text-graphite" aria-live="polite">
            {total} produit{total > 1 ? "s" : ""}
            {totalPages > 1 && ` · page ${q.page} sur ${totalPages}`}
          </p>
          <div className="flex items-center gap-3">
            <MobileFilters activeCount={chips.length} total={total}>
              {panel}
            </MobileFilters>
            <SortSelect value={q.tri} />
          </div>
        </div>

        {chips.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2 pt-5" aria-label="Filtres actifs">
            {chips.map((c) => (
              <li key={c.label}>
                <Link href={c.href} scroll={false} className="inline-flex h-8 items-center gap-2 rounded-full bg-mist pl-3.5 pr-2.5 text-sm transition-colors hover:bg-mist-deep" aria-label={`Retirer le filtre ${c.label}`}>
                  {c.label} <IconClose size={13} />
                </Link>
              </li>
            ))}
            <li>
              <Link href={reset} scroll={false} className="link-underline ml-2 text-sm text-graphite hover:text-ink">
                Tout effacer
              </Link>
            </li>
          </ul>
        )}

        {products.length === 0 ? (
          <div className="flex flex-col items-start gap-6 py-24">
            <p className="t-h3 max-w-lg">Aucun appareil ne correspond à ces critères.</p>
            <p className="max-w-lg text-graphite">Élargissez la fourchette de prix, retirez un filtre ou cherchez par marque ou par référence.</p>
            <ButtonLink href={reset} variant="outline">
              Effacer les filtres
            </ButtonLink>
          </div>
        ) : (
          <div className="hairline-grid mt-6 grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p._id} product={p} priority={i < 3} />
            ))}
          </div>
        )}

        <Pagination basePath={basePath} query={q} totalPages={totalPages} />
      </div>
    </div>
  );
}
