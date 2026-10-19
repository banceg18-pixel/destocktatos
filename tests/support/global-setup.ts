import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const db = path.join(root, "prisma", "test.db");
const tmp = path.join(root, "tests", ".tmp");

function clean() {
  for (const f of [db, `${db}-journal`]) fs.rmSync(f, { force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}

/** Base de test vierge : migrations appliquées depuis zéro (vérifie aussi qu'elles sont rejouables). */
export default function setup() {
  clean();
  execFileSync(process.execPath, [path.join(root, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
  return clean;
}
