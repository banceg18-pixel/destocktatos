import { AccountNav } from "@/components/account/AccountNav";

/** Gabarit de l'espace client (accès protégé par le middleware). */
export default function CompteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell grid gap-8 pb-20 pt-6 sm:gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:pb-24 lg:pt-12">
      <AccountNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
