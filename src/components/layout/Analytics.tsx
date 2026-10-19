"use client";

import Script from "next/script";
import { useCart } from "@/context/CartProvider";

/**
 * Google Analytics 4 — chargé uniquement si `NEXT_PUBLIC_GA_ID` est défini ET si
 * l'utilisateur a accepté les cookies (le site source le chargeait sans condition).
 */
export function Analytics() {
  const { termsAccepted } = useCart();
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || !termsAccepted) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});`}
      </Script>
    </>
  );
}

export default Analytics;
