import type { ContentSection, PageContent, SiteSettings } from "@/lib/cms/types";

/**
 * Identité de la société dans les contenus. Le site Destocktatos est exploité par REIMS GOLD (SARL) ;
 * les textes repris de l'ancien site (TATOS, Sevran) sont présentés avec la bonne identité :
 * - remplacements simples (nom, email, adresse, téléphone, hébergeur) sur toutes les chaînes ;
 * - blocs d'identité des pages légales générés à partir des réglages (WordPress → Réglages → Site
 *   et magasin → Informations légales), pour rester justes si le gérant les modifie.
 * Filet de sécurité appliqué aux contenus lus dans WordPress ; l'extension corrige aussi ses contenus.
 */
const OLD_PHONE = /(?:\+33[\s.-]*\(?6\)?[\s.-]*51[\s.-]*64[\s.-]*41[\s.-]*84|\b0?6[\s.-]?51[\s.-]?64[\s.-]?41[\s.-]?84\b)/g;

const REPLACEMENTS: [RegExp, string][] = [
  [/tatos-electromenager@[a-z0-9.-]+\.[a-z]{2,}/gi, "contacts@destocktatos.com"],
  [/\bTATOS\b/g, "Destocktatos"],
  [/contact@exemple\.fr/gi, "contacts@destocktatos.com"],
  [/Example Hosting<br\s*\/?>456 avenue du Web<br\s*\/?>69000 Lyon, France<br\s*\/?>Téléphone : \+33 \(0\)4 56 78 90 12/g, "Hostinger International Ltd<br/>61 Lordou Vironos Street<br/>6023 Larnaca, Chypre<br/>Site : www.hostinger.fr"],
  [/Example Hosting/g, "Hostinger International Ltd"],
  // Ancienne adresse (Sevran) : établissement de Poissy.
  [/15\+Rue\+Paul\+Langevin\+93270\+Sevran/gi, "65+Rue+d%27Aigremont+78300+Poissy"],
  [/\b1[25] rue paul l(?:angevin|evangin)\b/gi, "65 Rue d’Aigremont"],
  [/\b93270 Sevran\b/gi, "78300 Poissy"],
  [/^93270$/, "78300"],
  [/^Sevran$/i, "Poissy"],
  [/\+33-6-51-64-41-84/g, "+33-1-83-75-01-21"],
  [/\+33651644184/g, "+33183750121"],
];

export function rebrandText(s: string) {
  let out = s;
  for (const [re, by] of REPLACEMENTS) out = out.replace(re, by);
  // Téléphone : format international ou national d'origine conservé.
  return out.replace(OLD_PHONE, (m) => (m.trim().startsWith("+") ? "+33 1 83 75 01 21" : "01 83 75 01 21"));
}

/** Applique `rebrandText` à toutes les chaînes d'une valeur (objets et tableaux compris). */
export function rebrand<T>(value: T): T {
  if (typeof value === "string") return rebrandText(value) as T;
  if (Array.isArray(value)) return value.map((v) => rebrand(v)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v)])) as T;
  return value;
}

/* ------------------------------------------------------------------------------- Identité légale */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = 'class="text-[color:var(--text-main)] opacity-90 mb-3"';
const UL = 'class="list-disc list-inside space-y-2 text-[color:var(--text-main)] opacity-90"';

/** Informations légales : réglages, sinon valeurs fournies par le gérant (REIMS GOLD). */
export function company(s: SiteSettings) {
  return {
    name: s.legalName || "REIMS GOLD",
    form: s.legalForm || "SARL, société à responsabilité limitée",
    capital: s.legalCapital || "1 000,00 €",
    siren: s.legalSiren || "823 456 777",
    siret: s.legalSiret || "823 456 777 00015",
    rcs: s.legalRcs || "823 456 777 R.C.S. Reims",
    vat: s.legalVat || "FR48823456777",
    headOffice: s.legalHeadOffice || "3 Rue Émile Zola, 51100 Reims, France",
    establishment: `${s.addressLine}, ${s.postalCode} ${s.city}`,
    director: s.legalDirector || "Jasmine Touvoli",
    phone: s.phone,
    email: s.email,
  };
}

/** Mentions légales courtes, sur deux lignes (factures, devis, emails). */
export function legalLines(s: SiteSettings): [string, string] {
  const c = company(s);
  return [`${s.siteName} est exploité par ${c.name}, ${c.form.split(",")[0]} au capital de ${c.capital} — Siège social : ${c.headOffice}`, `SIRET ${c.siret} — ${c.rcs} — TVA intracommunautaire ${c.vat}`];
}

function editorHtml(s: SiteSettings) {
  const c = company(s);
  return `<p ${P}>Le site ${esc(s.siteName)} est édité par la société ${esc(c.name)}, ${esc(c.form)} au capital de ${esc(c.capital)}.</p><ul ${UL}><li>Numéro SIREN : ${esc(c.siren)}</li><li>Numéro SIRET (siège) : ${esc(c.siret)}</li><li>RCS : ${esc(c.rcs)}</li><li>N° TVA intracommunautaire : ${esc(c.vat)}</li><li>Siège social : ${esc(c.headOffice)}</li><li>Établissement : ${esc(c.establishment)}</li><li>Téléphone : ${esc(c.phone)}</li><li>Email : ${esc(c.email)}</li><li>Directeur de la publication : ${esc(c.director)} (gérant)</li></ul>`;
}

function controllerHtml(s: SiteSettings) {
  const c = company(s);
  return `<p ${P}>Le responsable du traitement des données personnelles collectées sur le Site est :</p><p class="text-[color:var(--text-main)] opacity-90">${esc(c.name)}, ${esc(c.form)} au capital de ${esc(c.capital)}, exploitant le site ${esc(s.siteName)}<br/>SIRET : ${esc(c.siret)} — ${esc(c.rcs)}<br/>Siège social : ${esc(c.headOffice)}<br/>Établissement : ${esc(c.establishment)}<br/>Représentée par : ${esc(c.director)} (gérant)<br/>Email : ${esc(c.email)}<br/>Téléphone : ${esc(c.phone)}</p>`;
}

/** Désignation du vendeur dans les CGV. */
function sellerText(s: SiteSettings) {
  const c = company(s);
  return `la société ${c.name}, ${c.form} au capital de ${c.capital}, dont le siège social est situé ${c.headOffice}, immatriculée au Registre du Commerce et des Sociétés sous le numéro ${c.rcs} (SIRET du siège : ${c.siret}, TVA intracommunautaire : ${c.vat}), dont l'établissement est situé ${c.establishment}, représentée par ${c.director}, gérant, exploitant le site ${s.siteName}`;
}

const OLD_SELLER =
  /la société (?:Destocktatos|TATOS), société par actions simplifiée, dont le siège social est situé [^,]+, \d{5} [^,]+, immatriculée au Registre du Commerce et des Sociétés sous le numéro SIRET \d+, activité NAF APE : [^,]+, dirigée par [^,]+/g;
const OLD_ADDRESS_LINES = /(Destocktatos)(, Service Clients| - Service DPO), /g;

/** Pages légales : désignation du vendeur, blocs « Éditeur du site » et « Responsable du traitement ». */
export function withCompany<T>(page: PageContent<T> | null, s: SiteSettings): PageContent<T> | null {
  if (!page?.sections) return page;
  const sections: ContentSection[] = page.sections.map((sec) => {
    if (page.slug === "mentions-legales" && /^Éditeur du site$/i.test(sec.title.trim())) return { ...sec, blocks: [{ type: "html", html: editorHtml(s) }] };
    if (page.slug === "politique-confidentialite" && /Responsable du traitement/i.test(sec.title)) return { ...sec, blocks: [{ type: "html", html: controllerHtml(s) }] };
    return {
      ...sec,
      blocks: sec.blocks.map((b) =>
        b.type === "html" || b.type === "paragraph"
          ? b.type === "html"
            ? { ...b, html: b.html.replace(OLD_SELLER, esc(sellerText(s))).replace(OLD_ADDRESS_LINES, `$1 (${esc(company(s).name)})$2, `) }
            : { ...b, text: b.text.replace(OLD_SELLER, sellerText(s)).replace(OLD_ADDRESS_LINES, `$1 (${company(s).name})$2, `) }
          : b,
      ),
    };
  });
  return { ...page, sections };
}
