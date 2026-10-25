// Starts the production server against a fresh, isolated SQLite database for E2E tests.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.argv[2] ?? "3200";
const env = { ...process.env, DATABASE_URL: "file:./e2e.db", ANTHROPIC_API_KEY: "" };
for (const f of ["prisma/e2e.db", "prisma/e2e.db-journal"]) rmSync(f, { force: true });
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
const child = spawn("npx", ["next", "start", "-p", port], { stdio: "inherit", env });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => process.exit(code ?? 0));
