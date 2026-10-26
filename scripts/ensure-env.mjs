// Cross-platform: makes sure a .env file with DATABASE_URL exists before Prisma/Next run.
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";

const DEFAULT = 'DATABASE_URL="file:./dev.db"';

if (!existsSync(".env")) {
  if (existsSync(".env.example")) copyFileSync(".env.example", ".env");
  else appendFileSync(".env", `${DEFAULT}\n`);
  console.log("Created .env from .env.example");
} else if (!/^\s*DATABASE_URL\s*=/m.test(readFileSync(".env", "utf8"))) {
  appendFileSync(".env", `\n${DEFAULT}\n`);
  console.log("Added DATABASE_URL to .env");
}
