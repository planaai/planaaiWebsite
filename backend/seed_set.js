const { prisma } = require('./db');

async function main() {
  // Create Limit Break Boss: Set
  const boss = await prisma.raidBoss.upsert({
    where: { id: 'set' },
    update: {},
    create: {
      id: 'set',
      name: '세트의 분노 (Set)',
      iconUrl: '/images/boss/set.png',
      defenseType: 'LightArmor',
    }
  });
  console.log('Created boss:', boss);

  // Add terrain for Set
  const difficulties = ['Normal', 'Hard', 'VeryHard', 'Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic'];
  const terrain = 'Indoor'; // Set is indoor and outdoor, let's just do Indoor

  const dataToInsert = difficulties.map(diff => ({
    bossId: 'set',
    terrain: terrain,
    difficulty: diff
  }));

  const result = await prisma.raidSeason.createMany({
    data: dataToInsert,
    skipDuplicates: true
  });
  console.log('Created seasons for Set:', result);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
