const { prisma } = require('./db');
const fs = require('fs');
const path = require('path');

async function main() {
  const masterFile = path.join(__dirname, 'data', 'plana_mapped.json');
  if (!fs.existsSync(masterFile)) {
    console.error('plana_mapped.json not found');
    return;
  }
  
  const students = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
  let created = 0;
  let updated = 0;

  for (const s of students) {
    let tactic = s.Role || s.tacticRole || 'DamageDealer';
    if (tactic === 'TacticalSupport' || tactic === 'T.S' || tactic === 'T.S.') tactic = 'Ride';

    const data = {
      id: s.id,
      name: s.name,
      school: s.school || 'ETC',
      squadType: (s.fieldType === 'Special' || s.squadType === 'Support') ? 'Support' : 'Main',
      tacticRole: tactic,
      bulletType: s.attackType || s.bulletType || 'Explosion',
      armorType: s.armorType || 'LightArmor',
      weaponType: s.weaponType || 'AR',
      position: s.position || 'Back',
      starGrade: s.starNum || s.starGrade || 1,
      isLimited: s.isLimited || false,
      imagePath: (s.portraitUrls && s.portraitUrls[0]) || s.portraitUrl || null,
      equipmentSlot1: s.equipmentSlot1 || null,
      equipmentSlot2: s.equipmentSlot2 || null,
      equipmentSlot3: s.equipmentSlot3 || null,
      primaryOopart: s.primaryOopart || null,
      secondaryOopart: s.secondaryOopart || null,
    };

    try {
      await prisma.student.upsert({
        where: { id: s.id },
        update: data,
        create: data
      });
      
      if (s.stats) {
        await prisma.studentStats.upsert({
          where: { studentId: s.id },
          update: {
            maxHP: s.stats.maxHP,
            attackPower: s.stats.attackPower,
            defensePower: s.stats.defensePower,
            healPower: s.stats.healPower,
          },
          create: {
            studentId: s.id,
            maxHP: s.stats.maxHP,
            attackPower: s.stats.attackPower,
            defensePower: s.stats.defensePower,
            healPower: s.stats.healPower,
          }
        });
      }
      updated++;
    } catch (e) {
      console.error(`Failed for student ${s.name}:`, e.message);
    }
  }
  console.log(`Seeded ${updated} students to Prisma DB.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
