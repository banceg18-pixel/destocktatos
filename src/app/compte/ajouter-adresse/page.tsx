import type { Metadata } from "next";
import { AddressManager } from "@/components/account/AddressManager";

// Rendue à chaque requête (paramètre ?edit=) : useSearchParams n'exige pas de <Suspense>.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lieferadresse", robots: { index: false, follow: false } };

export default async function AjouterAdressePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return (
    <div>
      <h1 className="t-h2">{edit ? "Adresse bearbeiten" : "Neue Adresse"}</h1>
      <p className="t-lead mt-5 max-w-xl text-graphite">Die Adresse wird für eine reibungslose Zustellung und genaue Lieferabstimmung erfasst.</p>
      <div className="mt-8 sm:mt-12">
        <AddressManager />
      </div>
    </div>
  );
}
