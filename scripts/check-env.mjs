#!/usr/bin/env node
/**
 * Vérifie la configuration d'environnement du site (sans afficher de secret).
 *
 *   node scripts/check-env.mjs
 */
import { spawnSync } from "node:child_process";

const env = (k) => (process.env[k] || "").trim();
const set = (k) => (env(k) ? `présent (${env(k).length} car.)` : "manquant");

// Charge .env si présent (sans écraser l'environnement existant).
try {
  const fs = await import("node:fs");
  const txt = fs.readFileSync(".env", "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* pas de .env */
}

let code = 0;
const section = (title) => console.log(`\n== ${title} ==`);
const check = (ok, label, detail = "") => {
  if (!ok) code = 1;
  console.log(` ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

section("Site");
const siteUrl = env("NEXT_PUBLIC_SITE_URL");
check(!!siteUrl, "NEXT_PUBLIC_SITE_URL", siteUrl || "manquant");
check(!!env("NEXTAUTH_URL"), "NEXTAUTH_URL", env("NEXTAUTH_URL"));
check(env("NEXTAUTH_SECRET").length >= 32, "NEXTAUTH_SECRET", set("NEXTAUTH_SECRET"));

section("Base de données");
const db = env("DATABASE_URL");
check(!!db, "DATABASE_URL", db ? (db.startsWith("postgres") ? "PostgreSQL (Neon)" : db.startsWith("file:") ? "SQLite locale" : "autre") : "manquante");
if (/^postgres/.test(db)) check(!!env("DATABASE_URL_UNPOOLED"), "DATABASE_URL_UNPOOLED", set("DATABASE_URL_UNPOOLED"));

section("CMS");
const cms = env("CMS_PROVIDER") || "local";
check(["local", "wordpress"].includes(cms), "CMS_PROVIDER", cms);
if (cms === "wordpress") check(!!env("WORDPRESS_API_URL"), "WORDPRESS_API_URL", env("WORDPRESS_API_URL"));

section("Emails (SMTP)");
// SMTP : soit le bloc complet, soit la boîte d'envoi locale (MAIL_OUTBOX_DIR) pour un environnement de test.
const smtp = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].every((k) => !!env(k));
check(smtp || env("MAIL_OUTBOX_DIR"), "SMTP complet ou outbox", smtp ? env("SMTP_HOST") : env("MAIL_OUTBOX_DIR") || "aucun");
const from = env("MAIL_FROM");
check((!!from && !/REMPLACEZ|^$/.test(from)) || !!env("SMTP_USER"), "MAIL_FROM (ou SMTP_USER)", from && !/REMPLACEZ/.test(from) ? from : "à compléter pour l'envoi réel d'emails");

section("Paiement — Bridge (virement direct)");
const bridgeLive = !!env("BRIDGE_CLIENT_ID") && !!env("BRIDGE_CLIENT_SECRET");
check(!!env("BRIDGE_CLIENT_ID"), "BRIDGE_CLIENT_ID", set("BRIDGE_CLIENT_ID"));
check(!!env("BRIDGE_CLIENT_SECRET"), "BRIDGE_CLIENT_SECRET", set("BRIDGE_CLIENT_SECRET"));
check(bridgeLive || env("BRIDGE_API_URL"), "BRIDGE_API_URL", env("BRIDGE_API_URL") || "défaut (api.bridgeapi.io)");
check(!!env("BRIDGE_WEBHOOK_SECRET"), "BRIDGE_WEBHOOK_SECRET", bridgeLive ? set("BRIDGE_WEBHOOK_SECRET") : "utile seulement en mode live");
console.log(`   ⇒ mode Bridge : ${bridgeLive ? "LIVE (guichet bancaire Bridge)" : "SIMULATEUR (/bank-sim, test local)"}`);

section("Paiement — virement manuel (SEPA)");
check(!!env("ADMIN_API_SECRET"), "ADMIN_API_SECRET", set("ADMIN_API_SECRET"));
check(!!env("WORDPRESS_WEBHOOK_SECRET"), "WORDPRESS_WEBHOOK_SECRET", set("WORDPRESS_WEBHOOK_SECRET"));
console.log(`   ⇒ Stripe : ${env("STRIPE_SECRET_KEY") ? "configuré" : "non configuré (virement uniquement)"}`);

section("Vérification du schéma PostgreSQL (le cas échéant)");
if (/^postgres/.test(env("DATABASE_URL"))) {
  const r = spawnSync("node", ["scripts/prisma-postgres.mjs", "--check"], { stdio: "inherit" });
  if (r.status !== 0) code = 1;
}

console.log(`\n${code === 0 ? "Tout est en ordre." : "Des éléments manquent : voir les ✗ ci-dessus."}`);
process.exit(code);
