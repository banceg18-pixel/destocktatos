import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForms } from "@/components/account/ProfileForms";
import { getSession, isGoogleEnabled } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mein Profil", robots: { index: false, follow: false } };

/** Profil : nom affiché, mot de passe (ou création pour un compte Google), suppression du compte. */
export default async function ProfilPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/connexion?callbackUrl=/compte/profil");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, passwordHash: true, createdAt: true } });
  if (!user) redirect("/connexion");
  return (
    <div>
      <h1 className="t-h2">Mein Profil</h1>
      <p className="mt-4 text-graphite">
        Kunde seit dem {user.createdAt.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}.
      </p>
      <ProfileForms name={user.name} email={user.email} hasPassword={!!user.passwordHash} googleEnabled={isGoogleEnabled()} />
    </div>
  );
}
