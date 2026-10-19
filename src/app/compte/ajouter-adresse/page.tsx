import type { Metadata } from "next";
import { AddressManager } from "@/components/account/AddressManager";

// Rendue à chaque requête (paramètre ?edit=) : useSearchParams n'exige pas de <Suspense>.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Adresse de livraison", robots: { index: false, follow: false } };

export default async function AjouterAdressePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return (
    <div>
      <h1 className="t-h2">{edit ? "Modifier l'adresse" : "Nouvelle adresse"}</h1>
      <p className="t-lead mt-5 max-w-xl text-graphite">L&apos;adresse est vérifiée auprès de la Base Adresse Nationale, pour un calcul exact de la distance de livraison.</p>
      <div className="mt-8 sm:mt-12">
        <AddressManager />
      </div>
    </div>
  );
}
