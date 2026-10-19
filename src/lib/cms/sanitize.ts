/**
 * Assainit le HTML d'un article (WordPress ou fichier local) avant affichage : seules les balises
 * de mise en forme éditoriale sont gardées, sans scripts, styles, cadres, gestionnaires d'événements
 * ni liens `javascript:`. Les images et liens gardent leurs attributs utiles.
 */
const ALLOWED = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i", "u", "a", "blockquote", "figure", "figcaption", "img", "br", "hr", "table", "thead", "tbody", "tr", "th", "td", "code", "pre", "span", "sup", "sub"]);
const ATTRS: Record<string, string[]> = { a: ["href", "title"], img: ["src", "alt", "width", "height"], th: ["colspan", "rowspan", "scope"], td: ["colspan", "rowspan"] };
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math|form|button|select|textarea)\b[\s\S]*?<\/\1\s*>/gi;

const safeUrl = (url: string) => {
  const u = url.trim();
  return /^(https?:|mailto:|tel:|\/|#)/i.test(u) && !/^\/\//.test(u) ? u : null;
};
const escAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (tag, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED.has(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      const keep: string[] = [];
      for (const m of rawAttrs.matchAll(/([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        const attr = m[1].toLowerCase();
        if (!(ATTRS[name] ?? []).includes(attr)) continue;
        let value = m[3] ?? m[4] ?? m[5] ?? "";
        if (attr === "href" || attr === "src") {
          const safe = safeUrl(value.replace(/&amp;/g, "&"));
          if (!safe) continue;
          value = safe;
        }
        keep.push(`${attr}="${escAttr(value)}"`);
      }
      if (name === "a") keep.push('rel="noopener noreferrer"');
      if (name === "img") keep.push('loading="lazy"', 'decoding="async"');
      return `<${name}${keep.length ? ` ${keep.join(" ")}` : ""}${name === "img" || name === "br" || name === "hr" ? " /" : ""}>`;
    });
}

/** Temps de lecture estimé (200 mots par minute). */
export function readingMinutes(html: string) {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
