/**
 * Enregistre en base la configuration d'envoi des emails (serveur SMTP de la boîte du magasin), lue
 * par le site quand les variables SMTP_* ne sont pas définies chez l'hébergeur. Vérifie d'abord la
 * connexion au serveur ; `--test <email>` envoie en plus un email d'essai.
 *
 *   npx tsx scripts/configure-email.ts <fichier.json> [--test destinataire@exemple.fr]
 *
 * Fichier JSON (hors dépôt) : { "host", "port", "user", "pass", "from", "store" }.
 */
import fs from "node:fs";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";

async function main() {
  const [file, flag, to] = process.argv.slice(2);
  if (!file) throw new Error("Usage : npx tsx scripts/configure-email.ts <fichier.json> [--test destinataire]");
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  const port = Number(c.port || 465);
  const config = { host: c.host, port, secure: c.secure ?? port === 465, user: c.user, pass: c.pass, from: c.from || c.user, store: c.store || c.user };
  const t = nodemailer.createTransport({ host: config.host, port, secure: config.secure, auth: { user: config.user, pass: config.pass }, connectionTimeout: 15_000 });
  await t.verify();
  console.log(`Connexion au serveur d'envoi ${config.host}:${port} réussie (${config.user}).`);
  const prisma = new PrismaClient();
  await prisma.siteState.upsert({ where: { key: "smtp" }, update: { value: JSON.stringify(config) }, create: { key: "smtp", value: JSON.stringify(config) } });
  await prisma.$disconnect();
  console.log("Configuration enregistrée : le site envoie ses emails depuis", config.from);
  if (flag === "--test" && to) {
    await t.sendMail({ from: config.from, to, subject: "Destocktatos — email d'essai", text: "La configuration d'envoi des emails du site fonctionne." });
    console.log("Email d'essai envoyé à", to);
  }
  t.close();
}

main().catch((e) => {
  console.error("Échec :", e.message);
  process.exit(1);
});
