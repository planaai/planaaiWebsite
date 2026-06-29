const { prisma } = require('./db');

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { username: true, role: true, nickname: true, uid: true }
    });
    console.log(`총 계정 수: ${users.length}`);
    users.forEach(u => {
      console.log(`- ${u.username} (닉네임: ${u.nickname || '없음'}, 역할: ${u.role}, UID: ${u.uid})`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
