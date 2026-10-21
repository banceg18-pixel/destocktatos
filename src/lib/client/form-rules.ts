import { FR_PHONE_HINT, isFrPhone } from "@/lib/phone";
/**
 * Règles de saisie partagées par tous les formulaires. Chaque message dit précisément quoi corriger,
 * avec un exemple quand le format compte. Une règle renvoie `null` quand la valeur est correcte.
 */
export type Rule = (value: string) => string | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const rules = {
  email: (v: string) => {
    const s = v.trim();
    if (!s) return "Saisissez votre adresse email.";
    if (!s.includes("@")) return "Il manque le « @ » : l'adresse doit ressembler à nom@exemple.fr.";
    if (!EMAIL.test(s)) return "Adresse email incomplète : elle doit ressembler à nom@exemple.fr.";
    return null;
  },
  loginPassword: (v: string) => (v ? null : "Saisissez votre mot de passe."),
  currentPassword: (v: string) => (v ? null : "Saisissez votre mot de passe actuel."),
  /** Mot de passe à créer : 8 caractères, au moins une lettre et un chiffre (règle du serveur). */
  newPassword: (v: string) => {
    if (!v) return "Choisissez un mot de passe.";
    const missing: string[] = [];
    if (v.length < 8) missing.push(`${8 - v.length} caractère${8 - v.length > 1 ? "s" : ""} de plus`);
    if (!/[A-Za-z]/.test(v)) missing.push("au moins une lettre (a à z)");
    if (!/\d/.test(v)) missing.push("au moins un chiffre");
    return missing.length ? `Mot de passe trop faible : ajoutez ${missing.join(", ").replace(/, ([^,]*)$/, " et $1")}.` : null;
  },
  confirmPassword: (password: string) => (v: string) => {
    if (!v) return "Saisissez à nouveau le mot de passe pour le confirmer.";
    return v === password ? null : "Les deux mots de passe ne sont pas identiques : vérifiez la saisie.";
  },
  name: (v: string) => {
    const s = v.trim();
    if (!s) return "Indiquez votre nom et votre prénom.";
    if (s.length < 2) return "Votre nom doit contenir au moins 2 caractères.";
    return null;
  },
  recipient: (v: string) => (v.trim().length >= 2 ? null : "Indiquez le nom de la personne qui réceptionne la livraison."),
  phone: (v: string) => {
    if (!v.trim()) return "Indiquez un numéro de téléphone.";
    // Numéros français uniquement (+33 accepté s'il est collé, inutile de le saisir).
    if (!isFrPhone(v)) return `Indiquez un ${FR_PHONE_HINT.charAt(0).toLowerCase()}${FR_PHONE_HINT.slice(1)}`;
    return null;
  },
  street: (v: string) => (v.trim().length >= 5 ? null : "Indiquez le numéro et le nom de la rue, par exemple 15 rue Paul Langevin."),
  postalCode: (v: string) => {
    const s = v.trim();
    if (!s) return "Indiquez le code postal.";
    return /^\d{5}$/.test(s) ? null : "Le code postal compte 5 chiffres, par exemple 93270.";
  },
  city: (v: string) => (v.trim().length >= 2 ? null : "Indiquez la ville."),
  choice: (what: string) => (v: string) => (v ? null : `Choisissez ${what}.`),
  text: (what: string, min: number) => (v: string) => {
    const s = v.trim();
    if (!s) return `Indiquez ${what}.`;
    return s.length < min ? `Trop court : ${what} doit faire au moins ${min} caractères (encore ${min - s.length}).` : null;
  },
  futureDate: (v: string) => {
    if (!v) return "Choisissez une date.";
    const d = new Date();
    const today = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    return v < today ? "Cette date est passée : choisissez aujourd'hui ou un jour suivant." : null;
  },
  optional: (rule: Rule) => (v: string) => (v.trim() ? rule(v) : null),
} as const;

/**
 * Erreurs renvoyées par l'API (validation serveur) rattachées aux champs du formulaire :
 * `details` = [{ champ, message }] ; `map` traduit le nom du champ serveur vers celui du formulaire.
 */
export function serverFieldErrors(details: unknown, map: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(details)) return out;
  for (const d of details as { champ?: string; message?: string }[]) {
    if (!d?.champ || !d.message) continue;
    const key = map[d.champ] ?? d.champ;
    out[key] ??= d.message;
  }
  return out;
}
