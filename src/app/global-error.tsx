"use client";

/**
 * Dernier filet de sécurité : erreur dans la mise en page elle-même. Page autonome (sans les
 * styles du site, qui peuvent ne pas être chargés), lisible et avec un bouton pour recharger.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f4f2", color: "#121212" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 520 }}>
            <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b6b68" }}>Chargement interrompu</p>
            <h1 style={{ fontSize: 36, lineHeight: 1.05, margin: "16px 0" }}>Le site n&apos;a pas pu s&apos;afficher.</h1>
            <p style={{ color: "#4a4a47", lineHeight: 1.6 }}>Votre connexion a peut-être été coupée, ou le site est très sollicité. Votre panier est conservé sur cet appareil.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  reset();
                  window.location.reload();
                }}
                style={{ background: "#121212", color: "#f4f4f2", border: 0, borderRadius: 2, padding: "16px 28px", fontSize: 13, letterSpacing: "0.09em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Recharger la page
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet voulu */}
              <a href="/" style={{ border: "1px solid #121212", color: "#121212", borderRadius: 2, padding: "15px 28px", fontSize: 13, letterSpacing: "0.09em", textTransform: "uppercase", textDecoration: "none" }}>
                Accueil
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
