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
  [/Example Hosting<br\s*\/?>456 avenue du Web<br\s*\/?>69000 Lyon, France<br\s*\/?>Téléphone : \+33 \(0\)4 56 78 90 12/g, "Hostinger International Ltd<br/>61 Lordou Vironos Street<br/>6023 Larnaca, Chypre<br/>Site : www.hostinger.fr"],
  [/Example Hosting/g, "Hostinger International Ltd"],
  // Adresse du magasin : 15 Rue Paul Langevin, 93270 Sevran (siège de Reims et variantes remplacés).
  [/\b1[25] rue paul l(?:angevin|evangin)\b/gi, "15 Rue Paul Langevin"],
  [/3 Rue Émile Zola,?\s*51100 Reims(?:,\s*France)?/gi, "15 Rue Paul Langevin, 93270 Sevran, France"],
  // Numéro unique du magasin : 07 80 96 12 16 (anciens numéros remplacés, tous formats).
  [/\+33-[16]-(?:51-64-41-84|83-75-01-21)/g, "+33-7-80-96-12-16"],
  [/\+33(?:651644184|183750121)/g, "+33780961216"],
  [/(?:\+33[\s.-]*\(?0?[16]\)?|\b0[16])[\s.-]?(?:51[\s.-]?64[\s.-]?41[\s.-]?84|83[\s.-]?75[\s.-]?01[\s.-]?21)\b/g, "07 80 96 12 16"],
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
  // Adresse du magasin : 15 Rue Paul Langevin, 93270 Sevran (remplace celle du siège de Reims).
  if (/Zola|51100/.test(`${s.addressLine} ${s.postalCode}`)) return { ...s, addressLine: "15 Rue Paul Langevin", postalCode: "93270", city: "Sevran", country: "France" };
  const m = s.addressLine?.match(/^(.+?),\s*(\d{5})\s+([^,]+?)(?:,\s*([^,]+?))?\s*$/);
  if (!m) return s;
  return { ...s, addressLine: m[1].trim(), postalCode: m[2], city: m[3].trim(), country: m[4]?.trim() || s.country };
}

/* ------------------------------------------------------------------------------- Identité légale */

/** Informations légales (factures, emails) : réglages, sinon celles des textes légaux du site. */
export function company(s: SiteSettings) {
  return {
    name: s.legalName || s.siteName || "Destocktatos",
    form: s.legalForm || "société par actions simplifiée",
    siret: s.legalSiret || "94228991900014",
    naf: s.legalNaf || "Commerce de gros non spécialisé",
    headOffice: s.legalHeadOffice || "15 rue Paul Langevin, 93270 Sevran",
    director: s.legalDirector || "Franck NEBOT",
    accountant: s.legalAccountant || "Madame Jasmine Touvoli",
  };
}

/** Mentions légales courtes, sur deux lignes (factures, emails). */
export function legalLines(s: SiteSettings): [string, string] {
  const c = company(s);
  return [`${c.name}, ${c.form} — Siège social : ${c.headOffice}`, `SIRET ${c.siret} — Activité NAF APE : ${c.naf}`];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = 'class="text-[color:var(--text-main)] opacity-90';

/** CGV, article 4 : paiement par virement bancaire uniquement. */
function paymentHtml(s: SiteSettings) {
  const b = bankDetailsOf(s);
  const name = s.siteName || "Destocktatos";
  return [
    "Le paiement est exigible à la commande, y compris pour les produits en précommande ou en cours de réapprovisionnement. Il s'effectue uniquement par virement bancaire, avant la livraison : ni carte bancaire, ni PayPal.",
    `Dès la validation de sa commande, l'Acheteur reçoit par email le devis correspondant, qui indique le montant à régler, les coordonnées bancaires de ${esc(name)} et la communication à mentionner sur le virement. Ces informations s'affichent également à l'écran à la confirmation de la commande. La facture est adressée par email dès réception du paiement.`,
    `Coordonnées bancaires : ${b.bank ? `${esc(b.bank)} — ` : ""}IBAN ${esc(b.iban)}${b.bic ? ` (BIC ${esc(b.bic)})` : ""}${b.reference ? ` — communication à indiquer : ${esc(b.reference)}, suivie si possible du numéro de commande` : ""}.`,
    `Les articles commandés sont réservés dans l'attente du virement. La commande est préparée puis livrée après réception du paiement. Aucune donnée bancaire de l'Acheteur n'est saisie ni conservée sur le site.`,
  ]
    .map((t, i, all) => `<p ${P}${i < all.length - 1 ? " mb-3" : ""}">${t}</p>`)
    .join("");
}

/** Mentions légales : médiation de la consommation (médiateur saisi dans les réglages, sinon sur demande). */
function mediatorHtml(s: SiteSettings) {
  const name = s.siteName || "Destocktatos";
  const mediator = s.legalMediatorName?.trim();
  const url = s.legalMediatorUrl?.trim();
  const who = mediator
    ? `Le médiateur de la consommation dont relève ${esc(name)} est : ${esc(mediator)}${url ? ` — <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="underline">${esc(url.replace(/^https?:\/\//, ""))}</a>` : ""}.`
    : "Les coordonnées du médiateur de la consommation compétent sont communiquées sur simple demande auprès du service client.";
  return [
    `Conformément aux dispositions du Code de la consommation concernant le règlement amiable des litiges, tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation.`,
    `Après démarche préalable écrite des consommateurs vis-à-vis de ${esc(name)} (contacts@destocktatos.com), le service de médiation peut être saisi pour tout litige de consommation dont le règlement n'aurait pas abouti.`,
    who,
  ]
    .map((t, i) => `<p ${P}${i < 2 ? " mb-3" : ""}">${t}</p>`)
    .join("");
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
        let html = b.html.replace(FAKE_PHONE, "06.51.64.41.84");
        if (!hasAccountant && page.slug === "mentions-legales" && /Éditeur du site/i.test(sec.title)) {
          html = html.replace(/(<li[^>]*>\s*Directeur de la publication\s*:[^<]*<\/li>)/, `$1<li>Comptable : ${esc(accountant)}</li>`);
        }
        if (!hasAccountant && page.slug === "politique-confidentialite" && /Responsable du traitement/i.test(sec.title)) {
          html = html.replace(/(Dirigée par\s*:\s*[^<]*<br\s*\/?>)/, `$1Comptable : ${esc(accountant)}<br/>`);
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
