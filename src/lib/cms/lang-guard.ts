import "server-only";

/**
 * Garde de langue : le site est « allemand uniquement ». WordPress peut encore contenir des
 * contenus éditoriaux français (pas encore réimportés). Tant qu'un texte WordPress contient
 * du français marquant, on sert à la place le contenu allemand du dépôt (data/content).
 * Une fois le contenu allemand importé dans WordPress, ce garde ne se déclenche plus
 * (le texte allemand ne contient aucun des marqueurs), il ne coûte presque rien
 * (une expression régulière sur le JSON du contenu, une fois par lecture et par requête).
 */
const FRENCH_MARKERS =
  /\b(livraison|livré|commande|panier|votre|vos|vous|merci|bienvenue|quantité|réduction|afficher|masquer|découvrez|profitez|veuillez|obligatoire|mot de passe|électroménager|garantie légale|retractation|rétractation|Conditions Générales|Politique de confidentialité|prix conseillé|franco|offerte partout)\b/i;

/** Un texte « marqué français » ? (string, objets et tableaux compris) */
export function looksFrench(value: unknown): boolean {
  if (typeof value === "string") return FRENCH_MARKERS.test(value);
  if (Array.isArray(value)) return value.some(looksFrench);
  if (value && typeof value === "object") return Object.values(value).some(looksFrench);
  return false;
}
