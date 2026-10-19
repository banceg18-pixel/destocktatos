import type { Metadata } from "next";
import { UnsubscribeForm } from "@/components/forms/UnsubscribeForm";

export const metadata: Metadata = { title: "Désinscription de la newsletter", robots: { index: false, follow: false } };

type SearchParams = Promise<{ email?: string; token?: string }>;

/** Lien « Se désinscrire » des emails : confirmation en un clic (le lien est signé). */
export default async function DesinscriptionPage({ searchParams }: { searchParams: SearchParams }) {
  const { email = "", token = "" } = await searchParams;
  return (
    <div className="shell flex min-h-[60vh] flex-col justify-center py-24">
      <h1 className="t-h2 max-w-2xl">Se désinscrire de la newsletter</h1>
      <UnsubscribeForm email={email} token={token} />
    </div>
  );
}
