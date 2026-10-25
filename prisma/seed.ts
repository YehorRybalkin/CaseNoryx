/**
 * Deterministic seed: creates the local profile, default settings and the five
 * cases. It never inserts user activity — progress only comes from real use.
 */
import { PrismaClient } from "@prisma/client";
import { bootstrapDatabase } from "../src/server/services/bootstrap";

const prisma = new PrismaClient();

bootstrapDatabase(prisma)
  .then(async () => {
    const n = await prisma.consultingCase.count();
    console.log(`Seed complete: local profile ready, ${n} cases in catalogue.`);
  })
  .catch((e) => {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
