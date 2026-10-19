import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { upsertGoogleUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { resetDb } from "../support/fixtures";

const outbox = process.env.MAIL_OUTBOX_DIR!;
let ip = 0;
/** Requête JSON (IP différente à chaque appel pour ne pas déclencher la limitation de débit). */
const req = (body: unknown, raw = false) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` },
    body: raw ? (body as string) : JSON.stringify(body),
  });

function lastResetToken() {
  const files = fs.existsSync(outbox) ? fs.readdirSync(outbox).filter((f) => f.endsWith("reinitialisation-mot-de-passe.json")).sort() : [];
  if (!files.length) return null;
  const mail = JSON.parse(fs.readFileSync(path.join(outbox, files.at(-1)!), "utf8"));
  return /token=([a-f0-9]{64})/.exec(mail.text)?.[1] ?? null;
}

beforeEach(async () => {
  await resetDb();
  resetRateLimits();
  fs.rmSync(outbox, { recursive: true, force: true });
});

describe("inscription", () => {
  it("crée un compte avec mot de passe haché (bcrypt), email normalisé", async () => {
    const res = await register(req({ email: "Nouveau@Tatos.TEST", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nouveau@tatos.test" } });
    expect(user.passwordHash).not.toContain("motdepasse1");
    expect(await bcrypt.compare("motdepasse1", user.passwordHash!)).toBe(true);
    expect(user.role).toBe("CUSTOMER");
  });

  it("refuse doublon (409), confirmation différente, mot de passe faible et JSON invalide (400)", async () => {
    await register(req({ email: "a@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    expect((await register(req({ email: "A@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }))).status).toBe(409);
    const mismatch = await register(req({ email: "b@tatos.test", mdp: "motdepasse1", mdpv: "autre" }));
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toBe("Mot de passe de confirmation erroné.");
    expect((await register(req({ email: "c@tatos.test", mdp: "court", mdpv: "court" }))).status).toBe(400);
    expect((await register(req("{pas du json", true))).status).toBe(400);
  });

  it("limitation de débit par IP (429 au 11e essai)", async () => {
    const same = () =>
      register(new Request("http://localhost/api", { method: "POST", headers: { "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify({ email: "x" }) }));
    for (let i = 0; i < 10; i++) expect((await same()).status).toBe(400);
    expect((await same()).status).toBe(429);
  });
});

describe("mot de passe oublié", () => {
  it("réponse identique que le compte existe ou non (pas d'énumération)", async () => {
    const a = await forgot(req({ email: "inconnu@tatos.test" }));
    expect(a.status).toBe(200);
    expect(lastResetToken()).toBeNull();
    await register(req({ email: "client@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    const b = await forgot(req({ email: "client@tatos.test" }));
    expect(await b.json()).toEqual(await (await forgot(req({ email: "inconnu2@tatos.test" }))).json());
  });

  it("lien à usage unique : réinitialise puis devient invalide ; jeton stocké haché", async () => {
    await register(req({ email: "client@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    await forgot(req({ email: "client@tatos.test" }));
    const token = lastResetToken()!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(await prisma.passwordResetToken.count({ where: { tokenHash: token } })).toBe(0);

    expect((await reset(req({ token, mdp: "nouveau123" }))).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "client@tatos.test" } });
    expect(await bcrypt.compare("nouveau123", user.passwordHash!)).toBe(true);
    expect((await reset(req({ token, mdp: "encore123" }))).status).toBe(400);
  });

  it("lien expiré ou mal formé refusé", async () => {
    await register(req({ email: "client@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    await forgot(req({ email: "client@tatos.test" }));
    const token = lastResetToken()!;
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(req({ token, mdp: "nouveau123" }))).status).toBe(400);
    expect((await reset(req({ token: "abc", mdp: "nouveau123" }))).status).toBe(400);
  });
});

describe("connexion Google", () => {
  it("crée le compte à la première connexion (email normalisé, sans mot de passe)", async () => {
    expect(await upsertGoogleUser({ email: "Client.Google@Gmail.COM", name: "Client Google", image: "https://lh3.googleusercontent.com/a/x", emailVerified: true })).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "client.google@gmail.com" } });
    expect(user.name).toBe("Client Google");
    expect(user.passwordHash).toBeNull();
    // Deuxième connexion : même compte, pas de doublon.
    expect(await upsertGoogleUser({ email: "client.google@gmail.com", name: "Autre nom", emailVerified: true })).toBe(true);
    expect(await prisma.user.count({ where: { email: "client.google@gmail.com" } })).toBe(1);
  });

  it("rattache un compte existant créé avec un mot de passe, sans toucher au mot de passe", async () => {
    const res = await register(req({ email: "mixte@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    expect(res.status).toBe(201);
    const before = await prisma.user.findUniqueOrThrow({ where: { email: "mixte@tatos.test" } });
    expect(await upsertGoogleUser({ email: "MIXTE@tatos.test", name: "Mixte", emailVerified: true })).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { email: "mixte@tatos.test" } });
    expect(after.id).toBe(before.id);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it("refuse un email Google non vérifié ou absent (pas de prise de contrôle d'un compte)", async () => {
    await register(req({ email: "victime@tatos.test", mdp: "motdepasse1", mdpv: "motdepasse1" }));
    expect(await upsertGoogleUser({ email: "victime@tatos.test", emailVerified: false })).toBe("/connexion?error=GoogleEmail");
    expect(await upsertGoogleUser({ email: "inconnu@tatos.test", emailVerified: undefined })).toBe("/connexion?error=GoogleEmail");
    expect(await upsertGoogleUser({ email: null, emailVerified: true })).toBe("/connexion?error=GoogleEmail");
    expect(await prisma.user.count({ where: { email: "inconnu@tatos.test" } })).toBe(0);
  });
});
