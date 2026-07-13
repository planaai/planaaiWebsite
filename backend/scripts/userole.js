const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

const askPassword = (query) => {
  return new Promise(resolve => {
    rl.question(query, (password) => {
      resolve(password);
    });
  });
};

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('사용법: node scripts/userole.js <UID> <0|1>');
    console.log('0: ADMIN, 1: USER');
    process.exit(1);
  }

  const targetUid = parseInt(args[0], 10);
  const roleCode = args[1];

  if (isNaN(targetUid)) {
    console.log('오류: UID는 숫자여야 합니다.');
    process.exit(1);
  }

  if (roleCode !== '0' && roleCode !== '1') {
    console.log('오류: Role 코드는 0(ADMIN) 또는 1(USER)이어야 합니다.');
    process.exit(1);
  }

  const targetRole = roleCode === '0' ? 'ADMIN' : 'USER';

  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });

    if (adminCount > 0) {
      console.log('이 명령을 실행하려면 관리자 권한이 필요합니다.');
      const adminUsername = await askQuestion('관리자 ID: ');
      const adminPassword = await askPassword('관리자 비밀번호: ');

      const adminUser = await prisma.user.findUnique({ where: { username: adminUsername } });
      if (!adminUser || adminUser.role !== 'ADMIN') {
        console.log('오류: 해당 ID는 관리자가 아니거나 존재하지 않습니다.');
        process.exit(1);
      }

      const isMatch = await bcrypt.compare(adminPassword, adminUser.password);
      if (!isMatch) {
        console.log('오류: 비밀번호가 일치하지 않습니다.');
        process.exit(1);
      }
      console.log('관리자 인증 완료.\n');
    } else {
      console.log('시스템에 관리자가 아직 없습니다. 최초 관리자 설정을 위해 인증을 생략합니다.\n');
    }

    const targetUser = await prisma.user.findUnique({ where: { uid: targetUid } });
    if (!targetUser) {
      console.log(`오류: UID가 ${targetUid}인 사용자를 찾을 수 없습니다.`);
      process.exit(1);
    }

    const updatedUser = await prisma.user.update({
      where: { uid: targetUid },
      data: { role: targetRole }
    });

    console.log(`성공: 사용자 '${updatedUser.username}'(UID: ${updatedUser.uid})의 권한이 [${targetRole}]로 설정되었습니다.`);
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
