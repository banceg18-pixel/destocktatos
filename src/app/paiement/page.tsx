import type { Metadata } from "next";
import { PaymentPage } from "@/components/checkout/PaymentPage";
import { CheckoutSteps } from "@/components/cart/CheckoutSteps";
import { getSiteSettings } from "@/lib/cms";

export const metadata: Metadata = { title: "Paiement", robots: { index: false, follow: false } };

export default async function Paiement() {
  const settings = await getSiteSettings();
  return (
    <div className="shell pb-24 pt-8 lg:pt-12">
      <div className="mb-10 flex flex-col gap-8 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="t-display">Paiement</h1>
        <CheckoutSteps current={2} />
      </div>
      <PaymentPage settings={settings} />
    </div>
  );
}
