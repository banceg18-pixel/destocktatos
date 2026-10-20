import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { SessionProvider } from "@/context/SessionProvider";
import { PopUpProvider } from "@/context/PopUpProvider";
import { CartProvider } from "@/context/CartProvider";
import { UiProvider } from "@/context/UiProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FooterGate } from "@/components/layout/FooterGate";
import { PageSlot } from "@/components/layout/PageSlot";
import { CookieConsentModal } from "@/components/layout/CookieConsentModal";
import { Toasts } from "@/components/layout/Popups";
import { Analytics } from "@/components/layout/Analytics";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { NetworkStatus } from "@/components/layout/NetworkStatus";
import { OfferPopup } from "@/components/layout/OfferPopup";
import { getMenus, getSiteSettings } from "@/lib/cms";
import { getCategories } from "@/lib/catalog/repository";
import { bannerMessagesOf } from "@/lib/banner";
import { jsonLd, organizationJsonLd, rootMetadata } from "@/lib/seo";

export const metadata: Metadata = rootMetadata;

/**
 * Pages rendues à chaque visite, depuis les caches mémoire du serveur (catalogue, contenus WordPress)
 * vidés dès qu'une modification est signalée : une modification faite dans WordPress est visible tout
 * de suite, et aucun CDN (celui de l'hébergeur notamment) ne garde une ancienne version d'une page.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121212",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, menus, categories] = await Promise.all([getSiteSettings(), getMenus(), getCategories()]);
  return (
    <html lang="fr" className={bannerMessagesOf(settings).length > 0 ? `${fontVariables} has-banner` : fontVariables}>
      <body>
        <a href="#contenu" className="sr-only z-[400] rounded-sm bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Aller au contenu
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationJsonLd(settings.phoneIntl))} />
        {/*
          Pas de session initiale : les pages restent statiques et next-auth lit la session côté client
          (/api/auth/session) au montage. Passer `session={null}` empêcherait cette lecture : un client
          connecté apparaîtrait déconnecté après chaque chargement complet de page.
        */}
        <SessionProvider>
          <PopUpProvider>
            <CartProvider>
              <UiProvider>
                <Analytics />
                <NavigationProgress />
                <NetworkStatus />
                <Header menu={menus.header} categories={categories} settings={settings} />
                <main id="contenu">
                  <PageSlot>{children}</PageSlot>
                </main>
                <FooterGate>
                  <Footer settings={settings} legal={menus.footerLegal} categories={categories} />
                </FooterGate>
                <CookieConsentModal />
                <OfferPopup />
                <Toasts />
              </UiProvider>
            </CartProvider>
          </PopUpProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
