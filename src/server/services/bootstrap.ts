import type { PrismaClient } from "@prisma/client";
import { CASES } from "@/lib/cases/registry";

export const LOCAL_USER_ID = "local";

/** Idempotently creates the local profile, its settings and the case catalogue. */
export async function bootstrapDatabase(db: PrismaClient) {
  await db.userProfile.upsert({ where: { id: LOCAL_USER_ID }, update: {}, create: { id: LOCAL_USER_ID } });
  await db.userSettings.upsert({ where: { id: LOCAL_USER_ID }, update: {}, create: { id: LOCAL_USER_ID, profileId: LOCAL_USER_ID } });
  for (const [i, c] of CASES.entries()) {
    await db.consultingCase.upsert({
      where: { id: c.slug },
      update: { title: c.title, difficulty: c.difficulty, industry: c.industry, sortOrder: i },
      create: { id: c.slug, title: c.title, difficulty: c.difficulty, industry: c.industry, sortOrder: i },
    });
  }
}
