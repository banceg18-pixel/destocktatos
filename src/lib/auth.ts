import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/server/rate-limit";

const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (!googleEnabled && (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET)) {
  console.warn("[auth] Connexion Google désactivée : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être renseignés tous les deux.");
}

/**
 * Connexion ou inscription via Google : le compte est retrouvé par son email (un client déjà inscrit
 * avec un mot de passe peut aussi se connecter avec Google), ou créé à la première connexion.
 * Seuls les emails vérifiés par Google sont acceptés, sinon n'importe qui pourrait prendre la main
 * sur un compte existant. Renvoie `true`, ou l'adresse de la page d'erreur à afficher.
 */
export async function upsertGoogleUser(p: { email?: string | null; name?: string | null; image?: string | null; emailVerified?: boolean | null }) {
  const email = p.email?.trim().toLowerCase();
  if (!email || p.emailVerified !== true) return "/connexion?error=GoogleEmail";
  await prisma.user.upsert({
    where: { email },
    update: { image: p.image ?? undefined },
    create: { email, name: p.name?.trim() || email.split("@")[0], image: p.image ?? null },
  });
  return true;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/connexion", error: "/connexion" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        mdp: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.mdp ?? "";
        if (!email || !password) return null;
        // Limite les tentatives par email (anti force brute).
        if (!rateLimit(`login:${email}`, 10, 15 * 60 * 1000).ok) {
          throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Laisse choisir le compte Google à chaque fois (utile sur un appareil partagé).
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const g = profile as { email?: string; email_verified?: boolean; name?: string; picture?: string } | undefined;
        return upsertGoogleUser({ email: g?.email ?? user.email, name: g?.name ?? user.name, image: g?.picture ?? user.image, emailVerified: g?.email_verified });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const db = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (db) {
          token.uid = db.id;
          token.role = db.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "CUSTOMER";
      }
      return session;
    },
  },
};

export const isGoogleEnabled = () => googleEnabled;

export function getSession() {
  return getServerSession(authOptions);
}

/** Utilisateur courant (null si non connecté). */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}
