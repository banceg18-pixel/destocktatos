import { isDePhone, DE_PHONE_HINT } from "@/lib/phone";
/**
 * Gemeinsame Eingaberegeln für alle Formulare. Jede Meldung gibt genau an, was zu korrigieren ist,
 * mit einem Beispiel, wenn das Format wichtig ist. Eine Regel gibt `null` zurück, wenn der Wert korrekt ist.
 */
export type Rule = (value: string) => string | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const rules = {
  email: (v: string) => {
    const s = v.trim();
    if (!s) return "Bitte geben Sie Ihre E-Mail-Adresse ein.";
    if (!s.includes("@")) return "Das « @ »-Zeichen fehlt: Die Adresse muss wie name@beispiel.de aussehen.";
    if (!EMAIL.test(s)) return "Unvollständige E-Mail-Adresse: sie muss wie name@beispiel.de aussehen.";
    return null;
  },
  loginPassword: (v: string) => (v ? null : "Bitte geben Sie Ihr Passwort ein."),
  currentPassword: (v: string) => (v ? null : "Bitte geben Sie Ihr aktuelles Passwort ein."),
  /** Neues Passwort: 8 Zeichen, mindestens ein Buchstabe und eine Ziffer (Server-Regel). */
  newPassword: (v: string) => {
    if (!v) return "Bitte wählen Sie ein Passwort.";
    const missing: string[] = [];
    if (v.length < 8) missing.push(`${8 - v.length} weiteres Zeichen${8 - v.length > 1 ? "n" : ""}`);
    if (!/[A-Za-z]/.test(v)) missing.push("mindestens einen Buchstaben (a bis z)");
    if (!/\d/.test(v)) missing.push("mindestens eine Ziffer");
    return missing.length ? `Passwort zu schwach: Fügen Sie ${missing.join(", ").replace(/, ([^,]*)$/, " und $1")} hinzu.` : null;
  },
  confirmPassword: (password: string) => (v: string) => {
    if (!v) return "Bitte geben Sie das Passwort zur Bestätigung erneut ein.";
    return v === password ? null : "Die beiden Passwörter stimmen nicht überein: bitte überprüfen Sie Ihre Eingabe.";
  },
  name: (v: string) => {
    const s = v.trim();
    if (!s) return "Bitte geben Sie Ihren Vor- und Nachnamen an.";
    if (s.length < 2) return "Ihr Name muss mindestens 2 Zeichen enthalten.";
    return null;
  },
  recipient: (v: string) => (v.trim().length >= 2 ? null : "Bitte geben Sie den Namen der Person an, die die Lieferung entgegennimmt."),
  phone: (v: string) => {
    if (!v.trim()) return "Bitte geben Sie eine Telefonnummer an.";
    if (!isDePhone(v)) return `Bitte geben Sie eine ${DE_PHONE_HINT.charAt(0).toLowerCase()}${DE_PHONE_HINT.slice(1)}`;
    return null;
  },
  street: (v: string) => (v.trim().length >= 5 ? null : "Bitte geben Sie Hausnummer und Straßenname an, z.B. Friedrichstraße 15."),
  postalCode: (v: string) => {
    const s = v.trim();
    if (!s) return "Bitte geben Sie die Postleitzahl an.";
    return /^\d{5}$/.test(s) ? null : "Die Postleitzahl hat 5 Ziffern, z.B. 10117.";
  },
  city: (v: string) => (v.trim().length >= 2 ? null : "Bitte geben Sie die Stadt an."),
  choice: (what: string) => (v: string) => (v ? null : `Bitte wählen Sie ${what}.`),
  text: (what: string, min: number) => (v: string) => {
    const s = v.trim();
    if (!s) return `Bitte geben Sie ${what} an.`;
    return s.length < min ? `Zu kurz: ${what} muss mindestens ${min} Zeichen haben (noch ${min - s.length}).` : null;
  },
  futureDate: (v: string) => {
    if (!v) return "Bitte wählen Sie ein Datum.";
    const d = new Date();
    const today = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    return v < today ? "Dieses Datum liegt in der Vergangenheit: bitte wählen Sie heute oder einen späteren Tag." : null;
  },
  optional: (rule: Rule) => (v: string) => (v.trim() ? rule(v) : null),
} as const;

/**
 * Vom API zurückgegebene Fehler (Server-Validierung), die den Formularfeldern zugeordnet sind:
 * `details` = [{ champ, message }]; `map` übersetzt den Server-Feldnamen in den Formularnamen.
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
