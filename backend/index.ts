import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 가상의 DB 데이터
let mockStudents = [
  {
    id: 1,
    name: '시로코*테러',
    school: 'Abydos',
    tacticRole: 'DamageDealer',
    bulletType: 'Mystic',
    armorType: 'MysticArmor',
    weaponType: 'AR',
    position: 'Middle',
    stats: {
      maxHP: 55747,
      attackPower: 5275,
      defensePower: 107
    }
  },
  {
    id: 2,
    name: '호시노 (수영복)',
    school: 'Abydos',
    tacticRole: 'Supporter',
    bulletType: 'Explosion',
    armorType: 'HeavyArmor',
    weaponType: 'SG',
    position: 'Front',
    stats: {
      maxHP: 75000,
      // attackPower 누락 시뮬레이션
      attackPower: null,
      defensePower: 500
    }
  },
  {
    id: 3,
    name: '아루',
    school: 'Gehenna',
    tacticRole: 'DamageDealer',
    bulletType: 'Explosion',
    armorType: 'LightArmor',
    weaponType: 'SR',
    position: 'Back',
    // stats 전체 누락 시뮬레이션
    stats: null
  }
];

// Health check / 빈 데이터 경고 판별 API
app.get('/api/admin/health-check', (req, res) => {
  const warnings = mockStudents.filter(s => !s.stats || s.stats.maxHP === null || s.stats.attackPower === null).map(s => {
    let msg = '필수 스탯 데이터가 누락되었습니다.';
    if (!s.stats) msg = '스탯 정보가 아예 없습니다.';
    else if (s.stats.attackPower === null) msg = '공격력(attackPower) 수치가 비어있습니다.';
    
    return {
      studentId: s.id,
      name: s.name,
      message: msg
    };
  });

  res.json({
    status: 'success',
    missingDataCount: warnings.length,
    warnings: warnings
  });
});

// 모든 학생 데이터 조회 API
app.get('/api/students', (req, res) => {
  res.json(mockStudents);
});

// 테스트용 임시 구동 서버
app.listen(port, () => {
  console.log(`Mock Backend Server running at http://localhost:${port}`);
});
