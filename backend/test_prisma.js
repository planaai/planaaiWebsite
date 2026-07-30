const { prisma } = require('./db');

async function main() {
  try {
    const newParty = await prisma.sharedPvpParty.create({
      data: {
        shortCode: 'TEST2',
        deckType: 'Attack',
        name: 'Test Name',
        party: { strikers: [null], specials: [null] },
        tags: [],
        tactics: 'Test Tactics',
        strategyCode: null,
        imagePath: null,
        youtubeUrls: null,
        authorId: 1 // Assuming user 1 exists, or we might get a foreign key error
      }
    });
    console.log('Success:', newParty);
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
