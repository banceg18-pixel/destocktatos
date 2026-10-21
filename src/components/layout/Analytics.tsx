"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useCart } from "@/context/CartProvider";

/**
 * Mesure d'audience, chargée uniquement si l'utilisateur a accepté les cookies :
 * - Google Analytics 4 si `NEXT_PUBLIC_GA_ID` est défini ;
 * - Pixel Meta si un identifiant est renseigné (`META_PIXEL_ID` ou `NEXT_PUBLIC_META_PIXEL_ID` chez
 *   l'hébergeur, lu à chaque visite : aucune reconstruction du site nécessaire).
 */
export function Analytics({ metaPixelId }: { metaPixelId?: string | null }) {
  const { termsAccepted } = useCart();
  const pathname = usePathname();
  const id = process.env.NEXT_PUBLIC_GA_ID;
  const pixel = metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // Une page vue Meta à chaque changement de page (navigation sans rechargement).
  useEffect(() => {
    if (termsAccepted && pixel) (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.("track", "PageView");
  }, [pathname, termsAccepted, pixel]);
  if (!termsAccepted) return null;
  return (
    <>
      {id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});`}
          </Script>
        </>
      )}
      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixel)});
fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}

export default Analytics;
