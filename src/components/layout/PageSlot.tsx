"use client";

import type { ReactNode } from "react";

/**
 * Composant transparent placé entre <main> et le contenu de la page.
 * Quand une partie de la page n'est pas encore prête au moment de l'hydratation (script en cours de
 * chargement), React suspend puis rejoue l'élément qui la contient. Rejouer directement une balise HTML
 * comme <main> lui fait perdre sa position dans la page (erreur d'hydratation #418 au rechargement) ;
 * rejouer ce composant, lui, est sans risque.
 */
export function PageSlot({ children }: { children: ReactNode }) {
  return children;
}
