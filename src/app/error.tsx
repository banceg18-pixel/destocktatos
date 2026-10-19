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
      <p className="t-spec text-graphite">{offline ? "Hors connexion" : "Chargement interrompu"}</p>
      <h1 className="t-display mt-6 max-w-3xl">{offline ? "La connexion a été perdue." : "Cette page n'a pas pu s'afficher."}</h1>
      <p className="t-lead mt-6 max-w-xl text-graphite">
        {offline
          ? "Vérifiez votre réseau puis réessayez. Votre panier est conservé sur cet appareil."
          : "Le site est peut-être très sollicité ou votre connexion a faibli. Réessayez dans un instant ; votre panier est conservé."}
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" onClick={retry} disabled={retrying}>
          {retrying ? "Nouvel essai…" : "Réessayer"}
        </Button>
        <ButtonLink href="/" size="lg" variant="outline">
          Retour à l&apos;accueil
        </ButtonLink>
      </div>
      {error.digest && <p className="t-spec mt-10 text-graphite-light">Référence : {error.digest}</p>}
    </div>
  );
}
