import { ensureSeeded } from '../src/server/seedClinicData.ts';
import { prisma } from '../src/server/db.ts';

async function main() {
  await ensureSeeded();
  console.log('Northfield Family Clinic database seeded successfully.');
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
