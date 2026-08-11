/**
 * Database seed (CLI). Delegates to the shared, idempotent bootstrap so the
 * same logic runs from `npm run db:seed` and from the /api/setup route.
 */
import { runSeed } from "../src/server/setup/bootstrap";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding database…");
  const result = await runSeed();
  console.log(`  Admin: ${result.adminEmail}${result.adminCreated ? " (created)" : " (already existed)"}`);
  console.log(`  Categories: ${result.categories}, States: ${result.states}, New example sources: ${result.sources}`);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
