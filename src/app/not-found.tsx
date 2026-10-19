import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false, follow: true } };

/** Page 404 : statut HTTP 404 et chemins utiles pour repartir. */
export default function NotFound() {
  return (
    <div className="shell flex min-h-[70vh] flex-col justify-center py-24">
      <p className="t-spec text-graphite">Erreur 404</p>
      <h1 className="t-display mt-6 max-w-3xl">Cette page n&apos;existe pas, ou plus.</h1>
      <p className="t-lead mt-6 max-w-xl text-graphite">
        Le produit a peut-être été retiré du catalogue, ou l&apos;adresse contient une faute de frappe. Voici de quoi repartir.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/boutique" size="lg" icon={<Arrow />}>
          Parcourir la boutique
        </ButtonLink>
        <ButtonLink href="/" size="lg" variant="outline">
          Retour à l&apos;accueil
        </ButtonLink>
      </div>
      <p className="mt-10 text-sm text-graphite">
        Une question ?{" "}
        <Link href="/contact" className="underline underline-offset-4 hover:text-ink">
          Contactez le magasin
        </Link>
        .
      </p>
    </div>
  );
}
