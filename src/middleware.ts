import { withAuth } from "next-auth/middleware";

/**
 * Routes réservées aux clients connectés : redirection vers /connexion?callbackUrl=…
 * (les API vérifient en plus la session côté serveur — la protection ne repose pas sur ce seul filtre).
 * /paiement n'en fait pas partie : on peut commander sans compte (accès limité à sa commande, voir buyer.ts).
 */
export default withAuth({
  pages: { signIn: "/connexion" },
});

export const config = {
  matcher: ["/compte/:path*", "/commande/:path*"],
};
