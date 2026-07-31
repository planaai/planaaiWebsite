const { prisma } = require('./db.js');
async function main() {
  const party = await prisma.sharedPvpParty.create({
    data: { deckType: 'ATTACK', name: 'Test Party', party: {}, tags: {}, tactics: 'Test', authorId: 1 }
  });
  const report = await prisma.report.create({
    data: { reporterId: 1, reportedPvpPartyId: party.id, reportedUserId: 1, reason: 'SPAM' }
  });
  
  const fetched = await prisma.report.findMany({
    where: { id: report.id },
    include: { reportedPvpParty: { select: { id: true, name: true, isBlinded: true, shortCode: true, deckType: true } } }
  });
  console.log("FETCHED:", JSON.stringify(fetched, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
