import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/** Creates a fresh, isolated SQLite database file for integration tests. */
export default function setup() {
  for (const f of ["test-integration.db", "test-integration.db-journal"]) rmSync(path.join("prisma", f), { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test-integration.db" },
  });
}
