import Link from "next/link";
import type { Product } from "@/types/catalog";
import { cn } from "@/lib/client/cn";
import { discountPercent } from "@/lib/money";
import { displayTitle } from "@/lib/text";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { Price, Tag } from "@/components/ui/Primitives";
import { QuickAdd } from "./QuickAdd";

/**
 * Carte produit commune (accueil, boutique, catégories, suggestions).
 * Image sur fond brume (la photo blanche s'y fond), seconde vue au survol, référence technique,
 * prix ; ajout rapide en surimpression (hors du lien pour rester accessible).
 */
export function ProductCard({ product, priority = false, className }: { product: Product; priority?: boolean; className?: string }) {
  const pct = discountPercent(product.prix, product.promotionPrix);
  const second = product.images?.find((i) => i.url && i.url !== product.imagePrincipale?.url);
  const href = `/boutique/${product.slug}`;
  return (
    <article className={cn("group relative flex flex-col bg-paper p-3 sm:p-4", className)}>
      <div className="relative aspect-square overflow-hidden bg-mist">
        <div className="absolute inset-0 p-[9%]">
          <ImageComponent
            img={product.imagePrincipale?.url}
            alt=""
            size={480}
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
            className={cn(
              "size-full object-contain mix-blend-multiply transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]",
              second && "group-hover:opacity-0",
            )}
          />
          {second && (
            <ImageComponent
              img={second.url}
              alt=""
              size={480}
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
              className="absolute inset-0 size-full scale-[0.98] object-contain p-[9%] opacity-0 mix-blend-multiply transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)] group-hover:scale-100 group-hover:opacity-100"
            />
          )}
        </div>
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {pct > 0 && <Tag tone="promo">-{pct} %</Tag>}
          {product.stock <= 0 && <Tag tone="paper">Épuisé</Tag>}
        </div>
        <QuickAdd
          product={product}
          className="absolute bottom-2.5 right-2.5 z-10 md:translate-y-2 md:opacity-0 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        />
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <p className="t-spec truncate text-graphite">
          {product.marque}
          {product.modele ? ` · ${product.modele}` : ""}
        </p>
        <h3 className="mt-1.5 line-clamp-2 font-sans text-[0.95rem] font-medium leading-snug tracking-normal [font-stretch:100%]">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none [&:focus-visible]:underline">
            {displayTitle(product.titre, product.marque)}
          </Link>
        </h3>
        <div className="mt-auto pt-3">
          <Price prix={product.prix} promotionPrix={product.promotionPrix} size="sm" />
          {product.stock === 1 && <p className="t-spec mt-1.5 text-warning">Dernier exemplaire</p>}
        </div>
      </div>
    </article>
  );
}
