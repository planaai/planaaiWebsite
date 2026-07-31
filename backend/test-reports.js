const { prisma } = require('./db.js');
async function main() {
  const reports = await prisma.report.findMany({
    where: { reportedPvpPartyId: { not: null } },
    include: { reportedPvpParty: true, reportedRaid: true },
    orderBy: { id: 'desc' },
    take: 1
  });
  console.log("REPORTS:");
  console.log(JSON.stringify(reports, null, 2));
  await new Promise(resolve => setTimeout(resolve, 500));
}
main().finally(() => process.exit(0));
