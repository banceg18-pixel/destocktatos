"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * Erreur pendant l'affichage d'une page (serveur momentanément indisponible, connexion coupée
 * pendant la navigation…). L'en-tête, le pied de page et le panier restent utilisables ;
 * « Réessayer » relance le rendu de la page sans recharger tout le site.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error(error);
    setOffline(navigator.onLine === false);
  }, [error]);

  const retry = () => {
    setRetrying(true);
    router.refresh();
    reset();
  };

  return (
    <div className="shell flex min-h-[70vh] flex-col justify-center py-24">
      <p className="t-spec text-graphite">{offline ? "Offline" : "Ladevorgang unterbrochen"}</p>
      <h1 className="t-display mt-6 max-w-3xl">{offline ? "Verbindung verloren." : "Diese Seite konnte nicht geladen werden."}</h1>
      <p className="t-lead mt-6 max-w-xl text-graphite">
        {offline
          ? "Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut. Ihr Warenkorb bleibt gespeichert."
          : "Der Server ist aktuell stark ausgelastet oder die Verbindung wurde unterbrochen. Bitte versuchen Sie es in Kürze erneut; Ihr Warenkorb bleibt erhalten."}
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" onClick={retry} disabled={retrying}>
          {retrying ? "Wird wiederholt…" : "Erneut versuchen"}
        </Button>
        <ButtonLink href="/" size="lg" variant="outline">
          Zur Startseite
        </ButtonLink>
      </div>
      {error.digest && <p className="t-spec mt-10 text-graphite-light">Fehlercode: {error.digest}</p>}
    </div>
  );
}
