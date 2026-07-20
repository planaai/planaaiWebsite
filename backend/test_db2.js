require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.collection.findFirst({
    where: { student: { name: { contains: '유우카' } } }
  });
  console.log('Collection:', c);
  if (c && c.details) {
    console.log('Details typeof:', typeof c.details);
    console.log('Details content:', JSON.stringify(c.details, null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
