const fs = require('fs');
const path = require('path');

let schemaConfig = {
  enums: {
    Role: { label: '전술 역할', values: [{ key: 'DamageDealer', label: '딜러' }, { key: 'Tanker', label: '탱커' }, { key: 'Healer', label: '힐러' }, { key: 'Supporter', label: '서포터' }, { key: 'Ride', label: '라이드' }] },
    AttackType: { label: '공격 속성', values: [{ key: 'Explosion', label: '폭발' }, { key: 'Pierce', label: '관통' }, { key: 'Mystic', label: '신비' }, { key: 'Vibration', label: '진동' }, { key: 'Decomposition', label: '분해' }] },
    ArmorType: { label: '방어 속성', values: [{ key: 'LightArmor', label: '경장갑' }, { key: 'HeavyArmor', label: '중장갑' }, { key: 'MysticArmor', label: '신비장갑' }, { key: 'ElasticArmor', label: '탄력장갑' }, { key: 'CompositeArmor', label: '복합장갑' }] },
    WeaponType: { label: '무기 타입', values: [{ key: 'AR', label: 'AR' }, { key: 'SR', label: 'SR' }, { key: 'SG', label: 'SG' }, { key: 'SMG', label: 'SMG' }, { key: 'MG', label: 'MG' }, { key: 'HG', label: 'HG' }, { key: 'GL', label: 'GL' }, { key: 'RL', label: 'RL' }, { key: 'MT', label: 'MT' }, { key: 'RG', label: 'RG' }, { key: 'FT', label: 'FT' }] },
    Position: { label: '포지션', values: [{ key: 'Front', label: 'Front' }, { key: 'Middle', label: 'Middle' }, { key: 'Back', label: 'Back' }] },
    School: { label: '학교', values: [{ key: 'Abydos', label: 'Abydos' }, { key: 'Gehenna', label: 'Gehenna' }, { key: 'Trinity', label: 'Trinity' }, { key: 'Millennium', label: 'Millennium' }, { key: 'Hyakkiyako', label: 'Hyakkiyako' }, { key: 'Shanhaijing', label: 'Shanhaijing' }, { key: 'RedWinter', label: 'Red Winter' }, { key: 'Valkyrie', label: 'Valkyrie' }, { key: 'SRT', label: 'SRT' }, { key: 'Arius', label: 'Arius' }, { key: 'Kronos', label: 'Kronos' }, { key: 'ETC', label: 'ETC' }] },
    Club: { label: '동아리', values: [{ key: 'ForeclosureTaskForce', label: '대책위원회' }, { key: 'PrefectTeam', label: '선도부' }, { key: 'GameDev', label: '게임개발부' }, { key: 'CandC', label: 'C&C' }, { key: 'Sisterhood', label: '시스터후드' }, { key: 'MakeUpWork', label: '보충수업부' }, { key: 'Justice', label: '정의실현부' }, { key: 'Seminar', label: '세미나' }, { key: 'Gourmet', label: '미식연구회' }, { key: 'HotSpring', label: '온천개발부' }, { key: 'Ninutsu', label: '인술연구부' }, { key: 'Rabbits', label: 'RABBIT 소대' }, { key: 'Foxes', label: 'FOX 소대' }, { key: 'Engineering', label: '엔지니어부' }, { key: 'Veritas', label: '베리타스' }, { key: 'TeaParty', label: '티파티' }, { key: 'Pandemonium', label: '만마전' }, { key: 'ETC', label: '기타' }] },
    FieldType: { label: '부대 유형', values: [{ key: 'Striker', label: 'STRIKER' }, { key: 'Special', label: 'SPECIAL' }] },
    EquipmentSlot1: { label: '장비 1 (모자/장갑/신발)', values: [{ key: 'Hat', label: '모자' }, { key: 'Gloves', label: '장갑' }, { key: 'Shoes', label: '신발' }] },
    EquipmentSlot2: { label: '장비 2 (배지/가방/헤어핀)', values: [{ key: 'Badge', label: '배지' }, { key: 'Bag', label: '가방' }, { key: 'Hairpin', label: '헤어핀' }] },
    EquipmentSlot3: { label: '장비 3 (부적/시계/목걸이)', values: [{ key: 'Charm', label: '부적' }, { key: 'Watch', label: '시계' }, { key: 'Necklace', label: '목걸이' }] },
    TerrainRank: { label: '지형 전투력', values: [{ key: 'SS', label: 'SS' }, { key: 'S', label: 'S' }, { key: 'A', label: 'A' }, { key: 'B', label: 'B' }, { key: 'C', label: 'C' }, { key: 'D', label: 'D' }] },
  },
  ooparts: [
    { key: 'Nebra', label: '네브라 스카이 디스크', tiers: [{name:'파손된 네브라 스카이 디스크', iconUrl:''}, {name:'훼손된 네브라 스카이 디스크', iconUrl:''}, {name:'마모된 네브라 스카이 디스크', iconUrl:''}, {name:'온전한 네브라 스카이 디스크', iconUrl:''}] },
    { key: 'Voynich', label: '보이니치 사본', tiers: [{name:'파손된 보이니치 사본', iconUrl:''}, {name:'훼손된 보이니치 사본', iconUrl:''}, {name:'마모된 보이니치 사본', iconUrl:''}, {name:'온전한 보이니치 사본', iconUrl:''}] },
    { key: 'Rohonc', label: '로혼치 사본', tiers: [{name:'파손된 로혼치 사본', iconUrl:''}, {name:'훼손된 로혼치 사본', iconUrl:''}, {name:'마모된 로혼치 사본', iconUrl:''}, {name:'온전한 로혼치 사본', iconUrl:''}] },
    { key: 'Phaistos', label: '파이스토스 원반', tiers: [{name:'파손된 파이스토스 원반', iconUrl:''}, {name:'훼손된 파이스토스 원반', iconUrl:''}, {name:'마모된 파이스토스 원반', iconUrl:''}, {name:'온전한 파이스토스 원반', iconUrl:''}] },
    { key: 'Wolfsegg', label: '볼프세크 강철', tiers: [{name:'부서진 볼프세크 강철', iconUrl:''}, {name:'조각난 볼프세크 강철', iconUrl:''}, {name:'마모된 볼프세크 강철', iconUrl:''}, {name:'온전한 볼프세크 강철', iconUrl:''}] },
    { key: 'Nimrud', label: '님루드 렌즈', tiers: [{name:'파손된 님루드 렌즈', iconUrl:''}, {name:'훼손된 님루드 렌즈', iconUrl:''}, {name:'마모된 님루드 렌즈', iconUrl:''}, {name:'온전한 님루드 렌즈', iconUrl:''}] },
    { key: 'Mandragora', label: '만드라고라', tiers: [{name:'부서진 만드라고라', iconUrl:''}, {name:'시든 만드라고라', iconUrl:''}, {name:'말라버린 만드라고라', iconUrl:''}, {name:'온전한 만드라고라', iconUrl:''}] },
    { key: 'Antikythera', label: '안티키테라 장치', tiers: [{name:'파손된 안티키테라 장치', iconUrl:''}, {name:'훼손된 안티키테라 장치', iconUrl:''}, {name:'마모된 안티키테라 장치', iconUrl:''}, {name:'온전한 안티키테라 장치', iconUrl:''}] }
  ],
  equipments: [
    { key: 'Hat', label: '모자', tiers: [] },
    { key: 'Gloves', label: '장갑', tiers: [] },
    { key: 'Shoes', label: '신발', tiers: [] },
    { key: 'Badge', label: '배지', tiers: [] },
    { key: 'Bag', label: '가방', tiers: [] },
    { key: 'Hairpin', label: '헤어핀', tiers: [] },
    { key: 'Charm', label: '부적', tiers: [] },
    { key: 'Watch', label: '시계', tiers: [] },
    { key: 'Necklace', label: '목걸이', tiers: [] }
  ],
  statFields: [
    { key: 'maxHP', label: '최대 체력', required: true }, { key: 'attackPower', label: '공격력', required: true }, { key: 'defensePower', label: '방어력', required: true }, { key: 'healPower', label: '치유력', required: false }, { key: 'accuracy', label: '명중', required: false }, { key: 'evasion', label: '회피', required: false }, { key: 'criticalRate', label: '치명 수치', required: false }, { key: 'criticalDamage', label: '치명 데미지', required: false }, { key: 'stability', label: '안정 수치', required: false }, { key: 'firingRange', label: '일반공격 사거리', required: false }, { key: 'costRecovery', label: '코스트 회복력', required: false }, { key: 'ccStrength', label: '군중제어 강화력', required: false }, { key: 'ccResistance', label: '군중제어 저항력', required: false },
  ],
  resourceIcons: {
    Credit: '',
    SecretTechSheet: '',
    TechNotes: {},
    BDs: {}
  }
};

const schemaFile = path.join(__dirname, '..', 'data', 'schemaConfig.json');
try {
  if (fs.existsSync(schemaFile)) {
    const loadedSchema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    schemaConfig = { ...schemaConfig, ...loadedSchema };
  }
} catch (e) {
  console.log('Failed to load schemaConfig.json', e.message);
}

const saveSchemaConfig = () => {
  try { fs.writeFileSync(schemaFile, JSON.stringify(schemaConfig, null, 2), 'utf8'); } catch(e) {}
};

const masterFile = path.join(__dirname, '..', 'data', 'plana_mapped.json');
let studentMasterDB = [];
try {
  if (fs.existsSync(masterFile)) {
    studentMasterDB = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
  }
} catch (e) {
  console.log('Failed to load plana_mapped.json, using empty array.', e.message);
}

const saveMasterDB = () => {
  try { fs.writeFileSync(masterFile, JSON.stringify(studentMasterDB, null, 2), 'utf8'); } catch(e) {}
};

module.exports = {
  getSchemaConfig: () => schemaConfig,
  setSchemaConfig: (newConfig) => { schemaConfig = newConfig; saveSchemaConfig(); },
  saveSchemaConfig,
  getStudentMasterDB: () => studentMasterDB,
  setStudentMasterDB: (newDB) => { studentMasterDB = newDB; saveMasterDB(); },
  saveMasterDB
};
