"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { MenuItem, SiteSettings } from "@/lib/cms/types";
import type { Category } from "@/types/catalog";
import { useCart } from "@/context/CartProvider";
import { useUi } from "@/context/UiProvider";
import { cn } from "@/lib/client/cn";
import { Arrow } from "@/components/ui/Primitives";
import { IconBag, IconChevron, IconMenu, IconSearch, IconUser } from "@/components/ui/Icons";
import { Logo } from "./Wordmark";
import { SearchPanel } from "./SearchPanel";
import { CartDrawer } from "./CartDrawer";
import { MobileMenu } from "./MobileMenu";
import { TopBanner } from "./TopBanner";
import { bannerMessagesOf } from "@/lib/banner";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * En-tête fixe, toujours visible. Transparent sur la grande image de l'accueil, opaque dès que
 * la page défile ou ailleurs. Menu « Boutique » déroulant (catégories), recherche instantanée,
 * mini-panier et menu mobile plein écran.
 */
export function Header({ menu, categories, settings }: { menu: MenuItem[]; categories: Category[]; settings: SiteSettings }) {
  const pathname = usePathname();
  const { status } = useSession();
  const { totalItems } = useCart();
  const { panel, openPanel, closePanel } = useUi();
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const megaTimer = useRef<number | undefined>(undefined);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Changement de page : on referme tout.
  useEffect(() => {
    setMega(false);
    closePanel();
  }, [pathname, closePanel]);

  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mega]);

  const overHero = isHome && !scrolled && !mega;
  const openMega = () => {
    window.clearTimeout(megaTimer.current);
    setMega(true);
  };
  const closeMegaSoon = () => {
    window.clearTimeout(megaTimer.current);
    megaTimer.current = window.setTimeout(() => setMega(false), 160);
  };
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const shopCategories = categories.filter((c) => (c.count ?? 0) > 0);
  const tone = overHero ? "glass" : "light";
  const bannerMessages = bannerMessagesOf(settings);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[200] transition-[background-color,color,border-color,backdrop-filter] duration-500",
          overHero ? "on-dark border-b border-transparent bg-gradient-to-b from-ink/55 to-transparent text-paper" : "border-b border-line bg-paper/92 text-ink backdrop-blur-xl",
        )}
        onMouseLeave={closeMegaSoon}
      >
        {bannerMessages.length > 0 && <TopBanner messages={bannerMessages} />}
        <div className="shell flex h-[var(--nav-h)] items-center gap-6">
          <Link href="/" className="shrink-0" aria-label={`${settings.siteName} — accueil`}>
            <Logo name={settings.siteName} />
          </Link>

          <nav aria-label="Navigation principale" className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-5 whitespace-nowrap xl:gap-9">
              {menu.map((item) => {
                const shop = item.href === "/boutique";
                return (
                  <li key={item.href} className="flex items-center gap-1" onMouseEnter={shop ? openMega : undefined}>
                    <Link
                      href={item.href}
                      data-cy={item.dataCy}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className="link-underline t-eyebrow py-2"
                    >
                      {item.label}
                    </Link>
                    {shop && (
                      <button
                        type="button"
                        aria-expanded={mega}
                        aria-controls="menu-categories"
                        aria-label="Afficher les catégories"
                        onClick={() => setMega((m) => !m)}
                        className="-mr-1 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
                      >
                        <IconChevron size={14} className={cn("transition-transform duration-300", mega && "rotate-180")} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <HeaderIcon tone={tone} label="Rechercher" onClick={() => openPanel("search")}>
              <IconSearch />
            </HeaderIcon>
            <Link
              href={status === "authenticated" ? "/compte" : "/connexion"}
              aria-label={status === "authenticated" ? "Mon compte" : "Se connecter"}
              title={status === "authenticated" ? "Mon compte" : "Se connecter"}
              className={headerIconClasses(tone, "max-sm:hidden")}
            >
              <IconUser />
              {status === "authenticated" && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-success" aria-hidden="true" />}
            </Link>
            <button
              type="button"
              data-cy="nav-panier"
              onClick={() => openPanel("cart")}
              aria-label={totalItems ? `Panier, ${totalItems} article${totalItems > 1 ? "s" : ""}` : "Panier vide"}
              title="Panier"
              className={headerIconClasses(tone)}
            >
              <IconBag />
              {totalItems > 0 && (
                <span
                  className={cn(
                    "t-price absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold",
                    overHero ? "bg-paper text-ink" : "bg-ink text-paper",
                  )}
                >
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>
            <HeaderIcon tone={tone} label="Ouvrir le menu" onClick={() => openPanel("menu")} className="lg:hidden" aria-expanded={panel === "menu"} aria-controls="menu-mobile">
              <IconMenu />
            </HeaderIcon>
          </div>
        </div>

        {/* Menu déroulant « Boutique » (bureau). */}
        <div
          id="menu-categories"
          onMouseEnter={openMega}
          className={cn(
            "absolute inset-x-0 top-full hidden border-b border-line bg-paper text-ink transition-[opacity,transform] duration-500 lg:block",
            mega ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
          )}
        >
          <div className="shell grid grid-cols-[1fr_340px] gap-12 py-10">
            <div>
              <p className="t-eyebrow mb-6 text-graphite">Catégories</p>
              <ul className="grid grid-cols-3 gap-x-10 gap-y-1">
                {shopCategories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/categorie/${c.slug}`} className="group flex items-baseline justify-between gap-3 border-b border-transparent py-2 hover:border-line">
                      <span className="text-[0.95rem] transition-transform duration-300 group-hover:translate-x-1">{capitalize(c.nom)}</span>
                      <span className="t-spec text-graphite">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/boutique" className="group flex items-center justify-between bg-ink px-6 py-6 text-paper">
                <span>
                  <span className="t-h3 block">Tout le catalogue</span>
                  <span className="t-spec mt-2 block text-white/60">{shopCategories.reduce((s, c) => s + (c.count ?? 0), 0)} produits disponibles</span>
                </span>
                <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link href="/promotions" className="group flex items-center justify-between bg-mist px-6 py-6">
                <span>
                  <span className="t-h3 block">Promotions</span>
                  <span className="t-spec mt-2 block text-graphite">Prix réduits du moment</span>
                </span>
                <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </header>
      {/* Réserve la hauteur de l'en-tête (sauf sur l'accueil où l'image passe dessous). */}
      {!isHome && <div aria-hidden="true" className="h-[var(--header-h)]" />}

      <SearchPanel open={panel === "search"} onClose={closePanel} categories={shopCategories} />
      <CartDrawer open={panel === "cart"} onClose={closePanel} />
      <MobileMenu open={panel === "menu"} onClose={closePanel} menu={menu} categories={shopCategories} settings={settings} />
    </>
  );
}

function headerIconClasses(tone: "glass" | "light", extra?: string) {
  return cn(
    "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
    tone === "glass" ? "bg-white/12 text-paper backdrop-blur-md hover:bg-paper hover:text-ink" : "border border-line text-ink hover:border-ink",
    extra,
  );
}

function HeaderIcon({
  tone,
  label,
  className,
  children,
  ...props
}: { tone: "glass" | "light"; label: string; className?: string; children: React.ReactNode } & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button type="button" aria-label={label} title={label} className={headerIconClasses(tone, className)} {...props}>
      {children}
    </button>
  );
}
