const { prisma } = require('./db');
const raidData = require('./raids.json');

async function seed() {
  console.log('Seeding bosses...');
  for (const boss of raidData.bosses) {
    await prisma.raidBoss.upsert({
      where: { id: boss.id },
      update: {},
      create: {
        id: boss.id,
        name: boss.name,
        iconUrl: boss.iconUrl,
        defenseType: boss.defenseType
      }
    });
  }

  console.log('Seeding seasons...');
  for (const season of raidData.seasons) {
    const exists = await prisma.raidSeason.findFirst({
      where: {
        bossId: season.bossId,
        terrain: season.terrain,
        difficulty: season.difficulty
      }
    });
    
    if (!exists) {
      await prisma.raidSeason.create({
        data: {
          bossId: season.bossId,
          terrain: season.terrain,
          difficulty: season.difficulty
        }
      });
    }
  }
  
  console.log('Done!');
}

seed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
