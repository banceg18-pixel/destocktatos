import type { ContentSection, PageContent, SiteSettings } from "@/lib/cms/types";
import { bankDetailsOf } from "@/lib/bank";

/**
 * Contenus au nom de Destocktatos. Les textes d'origine (TATOS) sont gardés tels quels, avec leurs
 * informations (forme, SIRET, adresse de Sevran, téléphone, dirigeant), sauf :
 * - le nom « TATOS », remplacé par « Destocktatos » ;
 * - l'email, remplacé par celui de Destocktatos ;
 * - l'hébergeur fictif du modèle, remplacé par l'hébergeur réel (Hostinger).
 * Pages légales : comptable ajoutée, paiement par virement bancaire uniquement (article 4 des CGV),
 * médiation sans texte à compléter. Filet de sécurité appliqué aux contenus lus dans WordPress.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/tatos-electromenager@[a-z0-9.-]+\.[a-z]{2,}/gi, "contacts@destocktatos.com"],
  [/contact@exemple\.fr/gi, "contacts@destocktatos.com"],
  [/\bTATOS\b/g, "Destocktatos"],
  [/Example Hosting<br\s*\/?>456 avenue du Web<br\s*\/?>69000 Lyon, France<br\s*\/?>Téléphone : \+33 \(0\)4 56 78 90 12/g, "Hostinger International Ltd<br/>61 Lordou Vironos Street<br/>6023 Larnaca, Zypern<br/>Website: www.hostinger.de"],
  [/Example Hosting/g, "Hostinger International Ltd"],
  // Adresse der Filiale Berlin
  [/\b1[25] rue paul l(?:angevin|evangin),?\s*93270 Sevran(?:,\s*France)?\b/gi, "Friedrichstraße 176-179, 10117 Berlin, Deutschland"],
  [/\b1[25] rue paul l(?:angevin|evangin)\b/gi, "Friedrichstraße 176-179"],
  [/3 Rue Émile Zola,?\s*51100 Reims(?:,\s*France)?/gi, "Friedrichstraße 176-179, 10117 Berlin, Deutschland"],
  [/15 Rue Paul Langevin,?\s*93270 Sevran(?:,\s*France)?/gi, "Friedrichstraße 176-179, 10117 Berlin, Deutschland"],
];

export function rebrandText(s: string) {
  let out = s;
  for (const [re, by] of REPLACEMENTS) out = out.replace(re, by);
  return out;
}

/** Applique `rebrandText` à toutes les chaînes d'une valeur (objets et tableaux compris). */
export function rebrand<T>(value: T): T {
  if (typeof value === "string") return rebrandText(value) as T;
  if (Array.isArray(value)) return value.map((v) => rebrand(v)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v)])) as T;
  return value;
}

/**
 * Adresse saisie en entier dans « Adresse » (ex. « 3 Rue Émile Zola, 51100 Reims, France ») : le code
 * postal, la ville et le pays en sont tirés, pour ne jamais afficher deux adresses mélangées.
 */
export function normalizeAddress<T extends Pick<SiteSettings, "addressLine" | "postalCode" | "city" | "country">>(s: T): T {
  // Adresse der Filiale Berlin
  if (/Zola|51100|Sevran|93270/.test(`${s.addressLine} ${s.postalCode}`)) return { ...s, addressLine: "Friedrichstraße 176-179", postalCode: "10117", city: "Berlin", country: "Deutschland" };
  const m = s.addressLine?.match(/^(.+?),\s*(\d{5})\s+([^,]+?)(?:,\s*([^,]+?))?\s*$/);
  if (!m) return s;
  return { ...s, addressLine: m[1].trim(), postalCode: m[2], city: m[3].trim(), country: m[4]?.trim() || s.country };
}

/* ------------------------------------------------------------------------------- Identité légale */

/** Informations légales (factures, emails) : réglages, sinon celles des textes légaux du site. */
export function company(s: SiteSettings) {
  return {
    name: s.legalName || s.siteName || "Destocktatos",
    form: s.legalForm || "GmbH",
    siret: s.legalSiret || "DE310108339",
    naf: s.legalNaf || "Groß- und Einzelhandel mit Haushaltsgeräten",
    headOffice: s.legalHeadOffice || "Friedrichstraße 176-179, 10117 Berlin, Deutschland",
    director: s.legalDirector || "Bernard Alexis Chabaud",
    accountant: s.legalAccountant || "Finanzabteilung",
  };
}

/** Mentions légales courtes, sur deux lignes (factures, emails). */
export function legalLines(s: SiteSettings): [string, string] {
  const c = company(s);
  return [`${c.name}, ${c.form} — Sitz: ${c.headOffice}`, `USt-IdNr.: ${c.siret} — Tätigkeitsbereich: ${c.naf}`];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = 'class="text-[color:var(--text-main)] opacity-90';

/** AGB, Artikel 4: Zahlung nur per Banküberweisung, Bankdaten als Liste aufgeführt. */
function paymentHtml(s: SiteSettings) {
  const b = bankDetailsOf(s);
  const name = s.siteName || "Destocktatos";
  const rows: [string, string][] = [
    ["Zuständige Abteilung", b.service],
    ["Kontoinhaber", b.holder],
    ...(b.bank ? ([["Bank", b.bank]] as [string, string][]) : []),
    ["IBAN", b.iban],
    ...(b.bic ? ([["BIC", b.bic]] as [string, string][]) : []),
  ];
  return [
    `<p ${P} mb-3">Die Zahlung ist bei der Bestellung fällig, auch für vorbestellte oder nachzuliefernde Artikel. Die Bezahlung erfolgt ausschließlich per Banküberweisung (Direktüberweisung oder SEPA-Standardüberweisung) vor der Lieferung: weder Kreditkarte noch PayPal.</p>`,
    `<p ${P} mb-3">Sobald die Bestellung bestätigt ist, erhält der Käufer per E-Mail die entsprechende Proforma-Rechnung/Bestellbestätigung mit dem zu zahlenden Betrag und den Bankdaten von ${esc(name)}. Diese Informationen werden auch am Bildschirm bei der Bestellbestätigung angezeigt. Die quittierte Rechnung wird unmittelbar nach Zahlungseingang per E-Mail versendet.</p>`,
    `<p ${P} mb-2 font-medium">Bankverbindung:</p>`,
    `<ul class="list-disc list-inside space-y-1 text-[color:var(--text-main)] opacity-90 mb-3">${rows.map(([l, v]) => `<li>${esc(l)}: ${esc(v)}</li>`).join("")}</ul>`,
    `<p ${P}">Die bestellten Artikel werden bis zum Zahlungseingang reserviert. Die Vorbereitung und der Versand erfolgen unmittelbar nach Eingang der Überweisung. Es werden keine Bankdaten des Käufers auf der Website gespeichert.</p>`,
  ].join("");
}

/** Impressum: Verbraucherschlichtung (EU / VSBG). */
function mediatorHtml(s: SiteSettings) {
  const name = s.siteName || "Destocktatos";
  const mediator = s.legalMediatorName?.trim();
  const url = s.legalMediatorUrl?.trim();
  const who = mediator
    ? `Zuständige Verbraucherschlichtungsstelle für ${esc(name)}: ${esc(mediator)}${url ? ` — <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="underline">${esc(url.replace(/^https?:\/\//, ""))}</a>` : ""}.`
    : "Die Kontaktdaten der zuständigen Verbraucherschlichtungsstelle werden auf einfache Anfrage beim Kundenservice mitgeteilt.";
  return [
    `<p ${P} mb-3">Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, die Sie unter <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" class="underline">https://ec.europa.eu/consumers/odr/</a> finden.</p>`,
    `<p ${P} mb-3">Wir sind bemüht, eventuelle Meinungsverschiedenheiten aus unserem Vertrag einvernehmlich beizulegen. Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht bereit.</p>`,
    `<p ${P}">${who}</p>`,
  ].join("");
}

/** Numéro factice du texte d'origine (article 10 des CGV) : celui du service après-vente. */
const FAKE_PHONE = /\b0123456789\b/g;

/**
 * Pages légales : textes d'origine au nom de Destocktatos, comptable ajoutée (mentions légales et
 * politique de confidentialité), paiement par virement uniquement, médiation sans texte à compléter.
 * Chaque correction ne s'applique que si le texte d'origine est encore là (aucun doublon).
 */
export function legalPage<T>(page: PageContent<T> | null, s: SiteSettings): PageContent<T> | null {
  if (!page?.sections) return page;
  const accountant = company(s).accountant;
  const hasAccountant = JSON.stringify(page.sections).includes("Comptable");
  const sections: ContentSection[] = page.sections.map((sec) => {
    const raw = sec.blocks.map((b) => (b.type === "html" ? b.html : b.type === "paragraph" ? b.text : "")).join(" ");
    if (page.slug === "cgv" && /^Article 4\b/i.test(sec.title.trim()) && /PayPal|carte bancaire/i.test(raw)) return { ...sec, blocks: [{ type: "html", html: paymentHtml(s) }] };
    if (/médiation de la consommation/i.test(sec.title) && /\[(Nom du service|URL du site)/i.test(raw)) return { ...sec, blocks: [{ type: "html", html: mediatorHtml(s) }] };
    return {
      ...sec,
      blocks: sec.blocks.map((b) => {
        if (b.type !== "html") return b;
        let html = b.html.replace(FAKE_PHONE, "+49 30 12345678");
        if (!hasAccountant && page.slug === "mentions-legales" && /(Éditeur du site|Herausgeber|Impressum)/i.test(sec.title)) {
          html = html.replace(/(<li[^>]*>\s*(Directeur de la publication|Geschäftsführer)\s*:[^<]*<\/li>)/i, `$1<li>Finanzabteilung / Buchhaltung: ${esc(accountant)}</li>`);
        }
        if (!hasAccountant && page.slug === "politique-confidentialite" && /(Responsable du traitement|Verantwortlicher)/i.test(sec.title)) {
          html = html.replace(/((Dirigée par|Vertreten durch)\s*:\s*[^<]*<br\s*\/?>)/i, `$1Finanzabteilung: ${esc(accountant)}<br/>`);
        }
        return { ...b, html };
      }),
    };
  });
  return { ...page, sections };
}

/** Pages légales réécrites par l'extension 2.7.0 (identité REIMS GOLD) : à remplacer par le texte du site. */
export function hasObsoleteIdentity(page: PageContent<unknown> | null) {
  return !!page && /REIMS GOLD|Aigremont|Ces informations sont tirées de Réglages/.test(JSON.stringify(page.sections ?? []));
}
