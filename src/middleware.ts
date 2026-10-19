import { withAuth } from "next-auth/middleware";

/**
 * Routes réservées aux clients connectés : redirection vers /connexion?callbackUrl=…
 * (les API vérifient en plus la session côté serveur — la protection ne repose pas sur ce seul filtre).
 */
export default withAuth({
  pages: { signIn: "/connexion" },
});

export const config = {
  matcher: ["/compte/:path*", "/paiement/:path*", "/commande/:path*"],
};
