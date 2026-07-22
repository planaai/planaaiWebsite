const { prisma } = require('./db');

async function main() {
  await prisma.raidBoss.updateMany({
    where: { id: 'set' },
    data: { category: 'LimitBreak' }
  });
  console.log('Set updated to LimitBreak');
}

main().finally(() => prisma.$disconnect());
