#!/usr/bin/env node
/**
 * Audit des assets locaux.
 *  - Manifeste (docs/assets-manifest.csv) : chaque asset téléchargé existe dans public/, avec la
 *    taille et l'empreinte SHA-256 enregistrées.
 *  - Références : chaque chemin local utilisé par le code, les contenus et la base (produits,
 *    catégories) pointe vers un fichier existant (aucun 404 d'asset).
 *  - Fichiers de public/assets absents du manifeste, échecs de téléchargement, doublons.
 *  - Métadonnées : aucune image ne contient de coordonnées GPS (EXIF).
 *
 *   npm run audit:assets     # code de sortie 1 si un asset manque ou diffère
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const require = createRequire(import.meta.url);
const errors = [];
const warnings = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const exists = (urlPath) => fs.existsSync(path.join(PUBLIC, decodeURIComponent(urlPath.split(/[?#]/)[0])));

/* ---------- 1. Manifeste ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else cell += c;
  }
  if (cell || row.length) endRow();
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const manifest = parseCsv(fs.readFileSync(path.join(ROOT, "docs", "assets-manifest.csv"), "utf8"));
const manifestPaths = new Set();
const failed = [];
let verified = 0;
let duplicates = 0;
for (const row of manifest) {
  if (row.status.startsWith("ECHEC")) {
    failed.push(row);
    continue;
  }
  if (row.status.startsWith("doublon")) duplicates++;
  manifestPaths.add(row.local_path);
  const file = path.join(PUBLIC, row.local_path);
  if (!fs.existsSync(file)) {
    errors.push(`manifeste : ${row.local_path} introuvable dans public/`);
    continue;
  }
  if (row.status !== "telecharge") continue; // un doublon pointe vers le fichier de l'original
  const buf = fs.readFileSync(file);
  if (row.bytes && Number(row.bytes) !== buf.length) errors.push(`manifeste : ${row.local_path} taille ${buf.length} ≠ ${row.bytes}`);
  else if (row.sha256 && crypto.createHash("sha256").update(buf).digest("hex") !== row.sha256) errors.push(`manifeste : ${row.local_path} empreinte SHA-256 différente`);
  else verified++;
}

/* ---------- 2. Références locales (code, contenus, base) ---------- */
const refs = new Map(); // chemin -> premier fichier qui le cite
const ASSET_RE = /["'(`\s=](\/(?:assets\/|favicon|icon|apple-touch|manifest)[^"'`)\s>]*\.(?:webp|png|jpe?g|gif|svg|ico|avif|woff2?|webmanifest))/gi;
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}
for (const base of ["src", "data", path.join("public", "manifest.webmanifest")]) {
  const abs = path.join(ROOT, base);
  if (!fs.existsSync(abs)) continue;
  const files = fs.statSync(abs).isDirectory() ? [...walk(abs)] : [abs];
  for (const f of files) {
    if (!/\.(tsx?|jsx?|mjs|css|json|webmanifest)$/.test(f)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(ASSET_RE)) if (!refs.has(m[1])) refs.set(m[1], rel(f));
  }
}
let dbRefs = 0;
try {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const add = (p, where) => {
    if (p && p.startsWith("/")) {
      dbRefs++;
      if (!refs.has(p)) refs.set(p, where);
    } else if (p) errors.push(`base : chemin non local « ${p} » (${where})`);
  };
  for (const p of await prisma.product.findMany({ select: { slug: true, imagePrincipale: true, etiquetteEnergie: true, images: { select: { url: true } } } })) {
    add(p.imagePrincipale, `base Product ${p.slug}`);
    add(p.etiquetteEnergie, `base Product ${p.slug}`);
    for (const i of p.images) add(i.url, `base ProductImage ${p.slug}`);
  }
  for (const c of await prisma.category.findMany({ select: { slug: true, image: true } })) add(c.image, `base Category ${c.slug}`);
  await prisma.$disconnect();
} catch (e) {
  warnings.push(`base de données non lue (${e.message.split("\n")[0]}) : lancez « npm run setup »`);
}
const missing = [...refs].filter(([p]) => !exists(p));
for (const [p, where] of missing) errors.push(`référence cassée : ${p} (cité par ${where})`);

/* ---------- 3. Fichiers hors manifeste ---------- */
const publicAssets = [...walk(path.join(PUBLIC, "assets"))].map((f) => `/${path.relative(PUBLIC, f).split(path.sep).join("/")}`);
const unlisted = publicAssets.filter((p) => !manifestPaths.has(p));
const unused = publicAssets.filter((p) => !refs.has(p) && !p.startsWith("/assets/fonts/"));

/* ---------- 4. Métadonnées GPS ---------- */
let withExif = 0;
const withGps = [];
/** Tags de l'IFD0 d'un en-tête TIFF (EXIF) situé à `start`, ou null s'il est invalide. */
function ifd0Tags(buf, start) {
  const tiff = buf.subarray(start);
  const le = tiff[0] === 0x49;
  const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  try {
    const ifd = u32(4);
    const n = u16(ifd);
    if (n === 0 || n > 512 || ifd + 2 + n * 12 > tiff.length) return null;
    return Array.from({ length: n }, (_, k) => u16(ifd + 2 + k * 12));
  } catch {
    return null;
  }
}
for (const p of publicAssets.filter((x) => /\.(jpe?g|webp|png|avif)$/i.test(x))) {
  const buf = fs.readFileSync(path.join(PUBLIC, p));
  if (buf.indexOf("Exif") < 0) continue;
  // Le bloc EXIF est un en-tête TIFF (« II*\0 » ou « MM\0* ») dont l'emplacement dépend du conteneur
  // (JPEG APP1, chunk WebP/PNG, item AVIF) : on teste chaque en-tête TIFF présent dans le fichier.
  const tags = [];
  for (const sig of [Buffer.from("II*\0", "latin1"), Buffer.from("MM\0*", "latin1")]) {
    for (let i = buf.indexOf(sig); i >= 0; i = buf.indexOf(sig, i + 1)) {
      const t = ifd0Tags(buf, i);
      if (t) tags.push(...t);
    }
  }
  if (!tags.length) {
    warnings.push(`EXIF illisible : ${p}`);
    continue;
  }
  withExif++;
  if (tags.includes(0x8825)) withGps.push(p);
}
for (const p of withGps) errors.push(`métadonnées GPS présentes : ${p}`);

/* ---------- Rapport ---------- */
console.log("Audit des assets");
console.log(`  manifeste : ${manifest.length} entrées — ${verified} fichiers vérifiés (taille + SHA-256), ${duplicates} doublons dédupliqués, ${failed.length} échecs de téléchargement documentés`);
for (const f of failed) {
  const stillUsed = refs.has(f.local_path);
  console.log(`    échec : ${f.source_url.replace(/^https?:\/\/[^/]+/, "<source>")} -> ${f.local_path || "(aucun fichier)"} [${f.status}]${stillUsed ? " — ENCORE RÉFÉRENCÉ" : " — non référencé"}`);
  if (stillUsed) errors.push(`asset en échec encore référencé : ${f.local_path}`);
}
console.log(`  références locales : ${refs.size} chemins distincts (code, contenus, ${dbRefs} en base) — ${missing.length} cassé(s)`);
console.log(`  public/assets : ${publicAssets.length} fichiers — ${unlisted.length} hors manifeste, ${unused.length} non référencé(s) (hors polices)`);
for (const p of unlisted.slice(0, 20)) console.log(`    hors manifeste : ${p}`);
for (const p of unused.slice(0, 20)) console.log(`    non référencé : ${p}`);
console.log(`  métadonnées : ${withExif} image(s) avec EXIF, ${withGps.length} avec coordonnées GPS`);
for (const w of warnings) console.log(`  ! ${w}`);
if (errors.length) {
  console.log(`\n✗ ${errors.length} problème(s) :`);
  for (const e of errors.slice(0, 100)) console.log(`  ${e}`);
  process.exitCode = 1;
} else {
  console.log("\n✓ Tous les assets référencés existent et correspondent au manifeste.");
}
