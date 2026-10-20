import "server-only";
import { SITE_URL } from "@/lib/seo";

/**
 * Gabarit HTML des emails, aux couleurs du site (encre, papier, rouge promo) : tableaux et styles en
 * ligne, lisibles dans tous les clients mail (Gmail, Outlook, Apple Mail, mobiles). Tout texte variable
 * passe par `esc`. Chaque email garde une version texte (accessibilité, filtres anti-spam).
 */
const INK = "#121212";
const GRAPHITE = "#6f6f6a";
const LINE = "#e3e3df";
const MIST = "#f1f1ef";
const PROMO = "#d7261e";
const FONT = "Helvetica, Arial, sans-serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Paragraphe (les retours à la ligne sont conservés, les adresses web deviennent des liens). */
export function para(text: string, opts: { muted?: boolean; size?: number } = {}) {
  const html = esc(text)
    .replace(/\n/g, "<br>")
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${INK};text-decoration:underline">$1</a>`);
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${opts.size ?? 15}px;line-height:1.6;color:${opts.muted ? GRAPHITE : INK}">${html}</p>`;
}

export function heading(text: string) {
  return `<h1 style="margin:0 0 20px;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.01em;color:${INK}">${esc(text)}</h1>`;
}

export function subheading(text: string) {
  return `<h2 style="margin:28px 0 12px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${INK}">${esc(text)}</h2>`;
}

/** Bouton (lien) : plein (encre) ou contour. */
export function button(label: string, url: string, variant: "solid" | "outline" = "solid") {
  const solid = variant === "solid";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 8px 8px 0;display:inline-table"><tr><td style="background:${solid ? INK : "#ffffff"};border:1px solid ${INK};border-radius:2px">
<a href="${esc(url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${solid ? "#ffffff" : INK};text-decoration:none">${esc(label)}</a>
</td></tr></table>`;
}

/** Encadré de lignes « libellé : valeur » (coordonnées bancaires, adresse…). */
export function infoBox(title: string, rows: [string, string, boolean?][], note?: string) {
  const trs = rows
    .map(
      ([label, value, mono]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-family:${FONT};font-size:13px;color:${GRAPHITE};white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;font-family:${mono ? "'Courier New', Courier, monospace" : FONT};font-size:14px;font-weight:700;color:${INK};word-break:break-all">${esc(value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;border:1px solid ${INK}"><tr><td style="padding:20px 22px">
<p style="margin:0 0 10px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}">${esc(title)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">${trs}</table>
${note ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${GRAPHITE}">${esc(note)}</p>` : ""}
</td></tr></table>`;
}

/** Récapitulatif : lignes d'articles puis totaux. */
export function orderTable(lines: { label: string; detail: string; amount: string }[], totals: { label: string; amount: string; strong?: boolean }[]) {
  const items = lines
    .map(
      (l) =>
        `<tr><td style="padding:12px 12px 12px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${INK}">${esc(l.label)}<br><span style="font-size:12px;color:${GRAPHITE}">${esc(l.detail)}</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${INK};white-space:nowrap">${esc(l.amount)}</td></tr>`,
    )
    .join("");
  const sums = totals
    .map(
      (t) =>
        `<tr><td style="padding:${t.strong ? "12px" : "5px"} 12px ${t.strong ? "0" : "5px"} 0;${t.strong ? `border-top:2px solid ${INK};` : ""}font-family:${FONT};font-size:${t.strong ? 16 : 14}px;font-weight:${t.strong ? 700 : 400};color:${t.strong ? INK : GRAPHITE}">${esc(t.label)}</td><td align="right" style="padding:${t.strong ? "12px" : "5px"} 0 ${t.strong ? "0" : "5px"};${t.strong ? `border-top:2px solid ${INK};` : ""}font-family:${FONT};font-size:${t.strong ? 18 : 14}px;font-weight:${t.strong ? 700 : 400};color:${INK};white-space:nowrap">${esc(t.amount)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">${items}${sums}</table>`;
}

export interface EmailStore {
  name: string;
  address: string;
  phone: string;
  email: string;
}

/** Page complète : bandeau, logotype, contenu, pied de page avec les coordonnées du magasin. */
export function emailLayout({ preheader, body, store }: { preheader?: string; body: string; store?: EmailStore | null }) {
  const name = store?.name || "Destocktatos";
  const contact = store ? [store.address, [store.phone, store.email].filter(Boolean).join(" · ")].filter(Boolean).map(esc).join("<br>") : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(name)}</title></head>
<body style="margin:0;padding:0;background:${MIST}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MIST}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td style="background:${PROMO};padding:9px 24px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-align:center">Déstockage · Livraison offerte partout en France</td></tr>
<tr><td style="padding:28px 32px 22px;border-bottom:1px solid ${LINE}"><a href="${SITE_URL}" style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:0.06em;color:${INK};text-decoration:none">${esc(name.toUpperCase())}</a></td></tr>
<tr><td style="padding:32px 32px 16px">${body}</td></tr>
<tr><td style="padding:24px 32px 30px;background:${INK}">
<p style="margin:0 0 6px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff">${esc(name)}</p>
${contact ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:#bdbdb8">${contact}</p>` : ""}
<p style="margin:0;font-family:${FONT};font-size:12px"><a href="${SITE_URL}" style="color:#ffffff;text-decoration:underline">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Version HTML d'un email simple : paragraphes du texte dans le gabarit. */
export function textEmail(text: string, store?: EmailStore | null) {
  const body = text
    .split(/\n{2,}/)
    .map((p) => para(p))
    .join("");
  return emailLayout({ body, store, preheader: text.split("\n").find((l) => l.trim() && !/^bonjour/i.test(l))?.slice(0, 120) });
}
