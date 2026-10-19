/**
 * Copie la documentation (docs/*.md et docs/img/) dans l'extension WordPress, qui l'affiche dans
 * l'administration (Boutique → Guide d'utilisation, Documentation technique).
 *
 *   npm run docs:plugin
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "docs");
const dest = path.join(root, "wordpress/plugins/tatos-headless/docs");
// Notes de réplication : historique du projet, sans intérêt dans l'administration.
const SKIP = new Set(["replication-notes.md"]);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith(".md") && !SKIP.has(f));
for (const f of files) cpSync(path.join(src, f), path.join(dest, f));
if (existsSync(path.join(src, "img"))) cpSync(path.join(src, "img"), path.join(dest, "img"), { recursive: true });
console.log(`Documentation copiée dans l'extension : ${files.length} fichiers${existsSync(path.join(src, "img")) ? " et les captures" : ""}.`);
