const { prisma } = require('./db');
const bcrypt = require('bcrypt');

async function main() {
  const adminUsername = 'admin';
  const adminPassword = 'adminpassword123!';

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingAdmin) {
    if (existingAdmin.role !== 'ADMIN') {
      await prisma.user.update({
        where: { username: adminUsername },
        data: { role: 'ADMIN' },
      });
      console.log('Existing admin user role updated to ADMIN.');
    } else {
      console.log('Admin user already exists.');
    }
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        nickname: 'SuperAdmin',
        role: 'ADMIN',
      },
    });
    console.log(`Admin user created! Username: ${adminUsername}, Password: ${adminPassword}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
