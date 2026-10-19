#!/usr/bin/env node
/**
 * Audit récursif des références au site d'origine.
 *
 * 1. Aucune occurrence du domaine source ni de son CDN d'images (Cloudinary) dans le code, les
 *    ressources, les données (y compris bases SQLite et métadonnées des images, lues en binaire)
 *    et le build. Seuls la documentation d'audit (docs/) et le cahier des charges peuvent en parler.
 * 2. Inventaire des hôtes externes cités dans le code et les données : tout hôte absent de la liste
 *    des exceptions documentées fait échouer l'audit.
 *
 *   npm run audit:source-refs              # code de sortie 1 si un problème est trouvé
 *   npm run audit:source-refs -- --hosts   # affiche aussi l'inventaire des hôtes autorisés
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SHOW_HOSTS = process.argv.includes("--hosts");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/** Motifs interdits hors documentation : définis une seule fois dans scripts/audit-patterns.json. */
const PATTERNS_FILE = path.join(ROOT, "scripts", "audit-patterns.json");
const SOURCE_PATTERNS = JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf8")).patterns.map((p) => new RegExp(p, "gi"));
/** Fichiers autorisés à mentionner la source : documentation et configuration d'audit uniquement. */
const DOC_ALLOWED = [/^docs\//, /^wordpress\/plugins\/tatos-headless\/docs\//,/^prompt_replication_[^/]*\.txt$/, /^scripts\/audit-patterns\.json$/, /^README\.md$/];

/** Dossiers ignorés : dépendances tierces, dépôt git, caches et fichiers temporaires. */
const SKIP_DIRS = new Set(["node_modules", ".git", "test-results", "cache"]);
const SKIP_PREFIXES = ["tests/.tmp/", "outbox/"];
/**
 * WordPress local (téléchargé depuis wordpress.org) : seuls nos contenus importés (base SQLite)
 * et notre plugin y sont audités ; le cœur WordPress tiers est exclu.
 */
const WP_LOCAL = "wordpress/.local/";
const WP_LOCAL_AUDITED = [/^wordpress\/\.local\/wp\/wp-content\/database\//, /^wordpress\/\.local\/wp\/wp-content\/plugins\/tatos-headless\//];

const BINARY = /\.(webp|png|jpe?g|gif|ico|avif|svgz|woff2?|ttf|otf|db|sqlite|db-journal|pdf|zip|phar|gz|br|wasm|node|exe|dll)$/i;

/**
 * Hôtes externes autorisés, avec justification. « réseau » = requête réelle possible à l'exécution
 * (exception documentée dans docs/replication-notes.md) ; « identifiant » = simple URI (espace de
 * noms, vocabulaire), aucune requête.
 */
const ALLOWED_HOSTS = {
  localhost: "développement local (frontend, WordPress)",
  "127.0.0.1": "développement local",
  "api-adresse.data.gouv.fr": "réseau — Base Adresse Nationale : autocomplétion et géocodage des adresses de livraison",
  "nominatim.openstreetmap.org": "réseau — géocodage de secours (règle reprise de la source)",
  "www.google.com": "réseau — carte Google Maps intégrée (iframe, page Contact/Services)",
  "maps.google.com": "réseau — lien « Itinéraire » vers Google Maps",
  "www.googletagmanager.com": "réseau — Google Analytics, uniquement si NEXT_PUBLIC_GA_ID est défini et après consentement",
  "www.google-analytics.com": "réseau — Google Analytics (idem, CSP)",
  "js.stripe.com": "réseau — Stripe Elements (paiement), uniquement avec clés Stripe",
  "api.stripe.com": "réseau — Stripe (paiement, CSP)",
  "hooks.stripe.com": "réseau — Stripe 3-D Secure (CSP)",
  "m.stripe.network": "réseau — Stripe (CSP)",
  "accounts.google.com": "réseau — connexion Google (OAuth), uniquement si GOOGLE_CLIENT_ID est défini",
  "lh3.googleusercontent.com": "réseau — avatars des comptes Google",
  "wordpress.org": "outillage — téléchargement de WordPress (wordpress/setup-local.sh)",
  "downloads.wordpress.org": "outillage — téléchargement du plugin SQLite (wordpress/setup-local.sh)",
  "raw.githubusercontent.com": "outillage — téléchargement de WP-CLI (wordpress/setup-local.sh)",
  "schema.org": "identifiant — vocabulaire JSON-LD",
  "www.w3.org": "identifiant — espaces de noms SVG/XML",
  "www.example.com": "identifiant — exemple dans la documentation de code",
  "example.com": "identifiant — exemple",
  "exemple.com": "identifiant — texte d'exemple (placeholder du formulaire de signalement)",
  "nextjs.org": "identifiant — lien de documentation dans next-env.d.ts (généré par Next.js)",
  // Métadonnées XML des étiquettes énergie SVG d'origine (conservées telles quelles, licence incluse).
  "www.inkscape.org": "identifiant — espace de noms XML (métadonnées SVG)",
  "sodipodi.sourceforge.net": "identifiant — espace de noms XML (métadonnées SVG)",
  "creativecommons.org": "identifiant — licence déclarée dans les métadonnées SVG",
  "purl.org": "identifiant — espace de noms Dublin Core (métadonnées SVG)",
  "www.ultraq.net.nz": "identifiant — espace de noms XML (métadonnées SVG)",
};

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const r = rel(full);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || SKIP_PREFIXES.some((p) => `${r}/`.startsWith(p))) continue;
      yield* walk(full);
    } else if (e.isFile()) {
      if (r.startsWith(WP_LOCAL) && !WP_LOCAL_AUDITED.some((re) => re.test(r))) continue;
      yield full;
    }
  }
}

const sourceHits = [];
const unknownHosts = new Map();
const knownHosts = new Map();
let scanned = 0;
let bytes = 0;

for (const file of walk(ROOT)) {
  const r = rel(file);
  const buf = fs.readFileSync(file);
  scanned++;
  bytes += buf.length;
  // latin1 : lecture octet par octet, valable aussi pour les fichiers binaires.
  const text = buf.toString("latin1");
  if (!DOC_ALLOWED.some((re) => re.test(r))) {
    for (const re of SOURCE_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const line = text.slice(0, m.index).split("\n").length;
        sourceHits.push(`${r}:${line}  « ${m[0]} »`);
      }
    }
  }
  // Inventaire des hôtes : fichiers texte du projet hors documentation et hors build.
  if (BINARY.test(r) || DOC_ALLOWED.some((re) => re.test(r)) || r.startsWith(".next/") || r.startsWith(WP_LOCAL) || r === "package-lock.json") continue;
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+[a-z0-9])/gi)) {
    const host = m[1].toLowerCase();
    const target = host in ALLOWED_HOSTS ? knownHosts : unknownHosts;
    if (!target.has(host)) target.set(host, new Set());
    target.get(host).add(r);
  }
}

console.log(`Audit des références à la source : ${scanned} fichiers, ${(bytes / 1e6).toFixed(1)} Mo analysés (binaires inclus).`);
if (sourceHits.length) {
  console.log(`\n✗ ${sourceHits.length} référence(s) à la source hors documentation :`);
  for (const h of sourceHits.slice(0, 200)) console.log(`  ${h}`);
} else {
  console.log("✓ 0 référence au domaine source ni à son CDN dans le code, les ressources, les données et le build.");
}
if (unknownHosts.size) {
  console.log(`\n✗ ${unknownHosts.size} hôte(s) externe(s) non justifié(s) :`);
  for (const [h, files] of unknownHosts) console.log(`  ${h}  <- ${[...files].slice(0, 5).join(", ")}`);
} else {
  console.log(`✓ Hôtes externes : uniquement des exceptions documentées (${knownHosts.size}).`);
}
if (SHOW_HOSTS) {
  console.log("\nHôtes externes cités :");
  for (const [h, files] of [...knownHosts].sort()) console.log(`  ${h} — ${ALLOWED_HOSTS[h]}\n      ${[...files].slice(0, 6).join(", ")}`);
}
process.exitCode = sourceHits.length || unknownHosts.size ? 1 : 0;
