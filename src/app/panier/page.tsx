import type { Metadata } from "next";
import { ClientPanier } from "@/components/cart/ClientPanier";
import { CheckoutSteps } from "@/components/cart/CheckoutSteps";
import { getSiteSettings } from "@/lib/cms";

export const metadata: Metadata = { title: "Panier", robots: { index: false, follow: true } };

export default async function PanierPage() {
  const settings = await getSiteSettings();
  return (
    <div className="shell pb-24 pt-8 lg:pt-12">
      <div className="mb-10 flex flex-col gap-8 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="t-display">Panier</h1>
        <CheckoutSteps current={0} />
      </div>
      <ClientPanier settings={settings} />
    </div>
  );
}
