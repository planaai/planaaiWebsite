const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prisma } = require('./db');
const { optionalAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 마스터 DB 수정 전용 라우트에 대한 일괄 관리자 인증 적용
app.use((req, res, next) => {
  const protectedPaths = ['/api/schema', '/api/images', '/api/master', '/api/upload', '/api/image-offsets'];
  const isProtectedPath = protectedPaths.some(p => req.path.startsWith(p));
  if (isProtectedPath && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return requireAdmin(req, res, next);
  }
  next();
});

// Routes
const authRouter = require('./routes/auth');
const collectionRouter = require('./routes/collection');
const plannerRouter = require('./routes/planner');
const importRouter = require('./routes/importRoute'); // NEW
const studentsRouter = require('./routes/students');
const imageOffsetsRouter = require('./routes/imageOffsets');
const noticesRouter = require('./routes/notices');

app.use('/api/auth', authRouter);
app.use('/api/collection', collectionRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/import', importRouter); // NEW
app.use('/api/students', studentsRouter);
app.use('/api/image-offsets', imageOffsetsRouter);
app.use('/api/notices', noticesRouter);

/* ═══════════════════════════════════════════════
   정적 파일 & Multer 업로드 설정 (스킬 아이콘 & 초상화)
   ═══════════════════════════════════════════════ */
const skillsDir = path.join(__dirname, 'uploads', 'skills');
if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });

const portraitsDir = path.join(__dirname, 'uploads', 'portraits');
if (!fs.existsSync(portraitsDir)) fs.mkdirSync(portraitsDir, { recursive: true });

const skillStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, skillsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'skill-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const portraitStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, portraitsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'portrait-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const illustsDir = path.join(__dirname, 'uploads', 'illusts');
if (!fs.existsSync(illustsDir)) fs.mkdirSync(illustsDir, { recursive: true });

const illustStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, illustsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'illust-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
const uploadSkill = multer({ storage: skillStorage, limits: { fileSize: FILE_SIZE_LIMIT } });
const uploadPortrait = multer({ storage: portraitStorage, limits: { fileSize: FILE_SIZE_LIMIT } });
const uploadIllust = multer({ storage: illustStorage, limits: { fileSize: FILE_SIZE_LIMIT } });

// /uploads 경로로 정적 파일 접근 허용
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));

// 이미지 업로드 API
app.post('/api/upload/skill-icon', uploadSkill.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ status: 'success', url: `/uploads/skills/${req.file.filename}` });
});

app.post('/api/upload/portrait', uploadPortrait.single('portrait'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ status: 'success', url: `/uploads/portraits/${req.file.filename}` });
});

app.post('/api/upload/illust', uploadIllust.single('illust'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ status: 'success', url: `/uploads/illusts/${req.file.filename}` });
});

/* ═══════════════════════════════════════════════
   동적 스키마 설정 (마스터 DB 구조 관리용)
   ═══════════════════════════════════════════════ */
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

const schemaFile = path.join(__dirname, 'data', 'schemaConfig.json');
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

const masterFile = path.join(__dirname, 'data', 'plana_mapped.json');
const saveMasterDB = () => {
  try { fs.writeFileSync(masterFile, JSON.stringify(studentMasterDB, null, 2), 'utf8'); } catch(e) {}
};

app.get('/api/schema', (req, res) => res.json(schemaConfig));

// Enum value CRUD
app.post('/api/schema/enums/:enumKey/values', (req, res) => {
  const enumDef = schemaConfig.enums[req.params.enumKey];
  if (!enumDef) return res.status(404).json({ error: 'Enum not found' });
  const { key, label } = req.body;
  if (!key || !label) return res.status(400).json({ error: 'key and label required' });
  if (enumDef.values.find(v => v.key === key)) return res.status(409).json({ error: 'Duplicate key' });
  enumDef.values.push({ key, label });
  saveSchemaConfig();
  res.json({ success: true });
});

app.delete('/api/schema/enums/:enumKey/values/:valueKey', (req, res) => {
  const enumDef = schemaConfig.enums[req.params.enumKey];
  if (!enumDef) return res.status(404).json({ error: 'Enum not found' });
  enumDef.values = enumDef.values.filter(v => v.key !== req.params.valueKey);
  saveSchemaConfig();
  res.json({ success: true });
});

app.post('/api/schema/ooparts', (req, res) => {
  schemaConfig.ooparts.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

app.put('/api/schema/ooparts/:key', (req, res) => {
  const index = schemaConfig.ooparts.findIndex(o => o.key === req.params.key);
  if (index > -1) schemaConfig.ooparts[index] = req.body;
  saveSchemaConfig();
  res.json({ success: true });
});

app.put('/api/schema/resourceIcons', (req, res) => {
  schemaConfig.resourceIcons = req.body;
  saveSchemaConfig();
  res.json({ success: true });
});

app.delete('/api/schema/ooparts/:key', (req, res) => {
  schemaConfig.ooparts = schemaConfig.ooparts.filter(o => o.key !== req.params.key);
  saveSchemaConfig();
  res.json({ success: true });
});

app.post('/api/schema/equipments', (req, res) => {
  schemaConfig.equipments.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

app.put('/api/schema/equipments/:key', (req, res) => {
  const index = schemaConfig.equipments.findIndex(e => e.key === req.params.key);
  if (index > -1) schemaConfig.equipments[index] = req.body;
  saveSchemaConfig();
  res.json({ success: true });
});

app.delete('/api/schema/equipments/:key', (req, res) => {
  schemaConfig.equipments = schemaConfig.equipments.filter(e => e.key !== req.params.key);
  saveSchemaConfig();
  res.json({ success: true });
});

app.post('/api/schema/gifts', (req, res) => {
  if (!schemaConfig.gifts) schemaConfig.gifts = [];
  schemaConfig.gifts.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

app.put('/api/schema/gifts/:key', (req, res) => {
  if (!schemaConfig.gifts) schemaConfig.gifts = [];
  const index = schemaConfig.gifts.findIndex(g => g.key === req.params.key);
  if (index > -1) schemaConfig.gifts[index] = req.body;
  else schemaConfig.gifts.push(req.body);
  saveSchemaConfig();
  res.json({ success: true });
});

app.delete('/api/schema/gifts/:key', (req, res) => {
  if (!schemaConfig.gifts) schemaConfig.gifts = [];
  schemaConfig.gifts = schemaConfig.gifts.filter(g => g.key !== req.params.key);
  saveSchemaConfig();
  res.json({ success: true });
});

const miscDir = path.join(__dirname, 'uploads', 'misc');
if (!fs.existsSync(miscDir)) fs.mkdirSync(miscDir, { recursive: true });

const dynamicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = req.query.folder || 'misc';
    folder = folder.replace(/\.\./g, '');
    const destDir = path.join(__dirname, 'uploads', folder);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadDynamic = multer({ storage: dynamicStorage, limits: { fileSize: FILE_SIZE_LIMIT } });

app.post('/api/images/upload', uploadDynamic.any(), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  let folder = req.query.folder || 'misc';
  folder = folder.replace(/\.\./g, '');
  const urls = req.files.map(file => `/uploads/${folder === '' ? '' : folder + '/'}${file.filename}`.replace('//', '/'));
  res.json({ status: 'success', urls });
});

app.get('/api/images', (req, res) => {
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) return res.json([]);
  
  let images = [];
  const readDirRecursive = (dir, basePath = '') => {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        readDirRecursive(fullPath, `${basePath}${f}/`);
      } else {
        images.push({
          url: `/uploads/${basePath}${f}`,
          name: f,
          size: stats.size,
          createdAt: stats.birthtime
        });
      }
    }
  };
  readDirRecursive(uploadDir);
  images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  res.json(images);
});

app.get('/api/images/folders', (req, res) => {
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) return res.json([]);
  let folders = [];
  const readDirRecursive = (dir, basePath = '') => {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        const folderPath = `${basePath}${f}`;
        folders.push(folderPath);
        readDirRecursive(fullPath, `${folderPath}/`);
      }
    }
  };
  readDirRecursive(uploadDir);
  res.json(folders);
});

app.delete('/api/images/file', (req, res) => {
  const urlPath = req.query.path;
  if (!urlPath) return res.status(400).json({ error: 'path required' });
  
  const uploadDir = path.join(__dirname, 'uploads');
  const safePath = urlPath.replace(/\.\./g, '');
  const fullPath = path.join(uploadDir, safePath);
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    fs.unlinkSync(fullPath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/images/files/delete', (req, res) => {
  const { paths } = req.body;
  if (!paths || !Array.isArray(paths)) return res.status(400).json({ error: 'paths array required' });
  
  const uploadDir = path.join(__dirname, 'uploads');
  let deletedCount = 0;
  
  paths.forEach(urlPath => {
    const safePath = urlPath.replace(/\.\./g, '');
    const fullPath = path.join(uploadDir, safePath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      deletedCount++;
    }
  });
  
  res.json({ success: true, deletedCount });
});

app.put('/api/images/file/rename', (req, res) => {
  const { newName } = req.body;
  const urlPath = req.query.path;
  if (!newName || !urlPath) return res.status(400).json({ error: 'newName and path required' });
  
  const uploadDir = path.join(__dirname, 'uploads');
  const safePath = urlPath.replace(/\.\./g, '');
  const fullPath = path.join(uploadDir, safePath);
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const dir = path.dirname(fullPath);
    const newFullPath = path.join(dir, newName);
    fs.renameSync(fullPath, newFullPath);
    
    const basePath = path.dirname(safePath);
    const oldUrl = `/uploads/${safePath}`.replace(/\\/g, '/');
    const newUrl = `/uploads/${basePath === '.' ? '' : basePath + '/'}${newName}`.replace(/\\/g, '/');
    
    updateImageReferences(oldUrl, newUrl);
    res.json({ success: true, oldUrl, newUrl });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.put('/api/images/file/move', (req, res) => {
  const { targetFolder } = req.body;
  const urlPath = req.query.path;
  if (targetFolder === undefined || !urlPath) return res.status(400).json({ error: 'targetFolder and path required' });

  const uploadDir = path.join(__dirname, 'uploads');
  const safePath = urlPath.replace(/\.\./g, '');
  const fullPath = path.join(uploadDir, safePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const filename = path.basename(fullPath);
    const safeTarget = targetFolder.replace(/\.\./g, '');
    const destDir = safeTarget === 'root' || safeTarget === '' ? uploadDir : path.join(uploadDir, safeTarget);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    
    const destPath = path.join(destDir, filename);
    if (fullPath !== destPath) {
      fs.renameSync(fullPath, destPath);
    }
    
    const oldUrl = `/uploads/${safePath}`.replace(/\\/g, '/');
    const newUrl = (safeTarget === 'root' || safeTarget === '' ? `/uploads/${filename}` : `/uploads/${safeTarget}/${filename}`).replace(/\\/g, '/');
    
    updateImageReferences(oldUrl, newUrl);
    res.json({ success: true, oldUrl, newUrl });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.put('/api/images/files/move', (req, res) => {
  const { targetFolder, paths } = req.body;
  if (targetFolder === undefined || !paths || !Array.isArray(paths)) return res.status(400).json({ error: 'targetFolder and paths array required' });

  const uploadDir = path.join(__dirname, 'uploads');
  const safeTarget = targetFolder.replace(/\.\./g, '');
  const destDir = safeTarget === 'root' || safeTarget === '' ? uploadDir : path.join(uploadDir, safeTarget);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const movedItems = [];

  paths.forEach(urlPath => {
    const safePath = urlPath.replace(/\.\./g, '');
    const fullPath = path.join(uploadDir, safePath);
    
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const filename = path.basename(fullPath);
      const destPath = path.join(destDir, filename);
      
      if (fullPath !== destPath) {
        fs.renameSync(fullPath, destPath);
        
        const oldUrl = `/uploads/${safePath}`.replace(/\\/g, '/');
        const newUrl = (safeTarget === 'root' || safeTarget === '' ? `/uploads/${filename}` : `/uploads/${safeTarget}/${filename}`).replace(/\\/g, '/');
        
        updateImageReferences(oldUrl, newUrl);
        movedItems.push({ oldUrl, newUrl });
      }
    }
  });

  res.json({ success: true, movedItems });
});

app.post('/api/images/folder', (req, res) => {
  const { folderName } = req.body;
  if (!folderName) return res.status(400).json({ error: 'folderName required' });
  const safePath = folderName.replace(/\.\./g, '');
  const targetPath = path.join(__dirname, 'uploads', safePath);
  if (fs.existsSync(targetPath)) return res.status(400).json({ error: 'Folder already exists' });
  
  fs.mkdirSync(targetPath, { recursive: true });
  res.json({ success: true });
});

app.delete('/api/images/folder', (req, res) => {
  const folderPath = req.query.path;
  if (!folderPath) return res.status(400).json({ error: 'path required' });
  const safePath = folderPath.replace(/\.\./g, '');
  const targetPath = path.join(__dirname, 'uploads', safePath);
  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Folder not found' });
  
  fs.rmSync(targetPath, { recursive: true, force: true });
  res.json({ success: true });
});

app.put('/api/images/folder/rename', (req, res) => {
  const { oldPath, newName } = req.body;
  if (!oldPath || !newName) return res.status(400).json({ error: 'oldPath and newName required' });
  
  const safeOldPath = oldPath.replace(/\.\./g, '');
  const safeNewName = newName.replace(/\.\./g, '').replace(/\//g, '');
  const uploadDir = path.join(__dirname, 'uploads');
  const targetOldPath = path.join(uploadDir, safeOldPath);
  
  if (!fs.existsSync(targetOldPath)) return res.status(404).json({ error: 'Folder not found' });
  
  const parentDir = path.dirname(targetOldPath);
  const targetNewPath = path.join(parentDir, safeNewName);
  
  if (fs.existsSync(targetNewPath)) return res.status(400).json({ error: 'New folder name already exists' });
  
  fs.renameSync(targetOldPath, targetNewPath);
  
  const newRelPath = path.relative(uploadDir, targetNewPath).replace(/\\/g, '/');
  const oldRelPath = path.relative(uploadDir, targetOldPath).replace(/\\/g, '/');
  
  const oldPrefix = `/uploads/${oldRelPath}/`;
  const newPrefix = `/uploads/${newRelPath}/`;
  
  let updatedCount = 0;
  
  const updateUrl = (url) => {
    if (typeof url === 'string' && url.startsWith(oldPrefix)) {
      updatedCount++;
      return newPrefix + url.slice(oldPrefix.length);
    }
    return url;
  };

  studentMasterDB.forEach(master => {
    if (master.portraitUrls && Array.isArray(master.portraitUrls)) {
      master.portraitUrls = master.portraitUrls.map(updateUrl);
    }
    master.favoriteItemUrl = updateUrl(master.favoriteItemUrl);
    if (master.skills && Array.isArray(master.skills)) {
      master.skills.forEach(skillSet => {
        ['ex', 'normal', 'passive', 'sub', 'normalPlus', 'passivePlus'].forEach(k => {
          if (skillSet[k]) {
             if (Array.isArray(skillSet[k])) {
                skillSet[k].forEach(s => { if (s && s.iconUrl) s.iconUrl = updateUrl(s.iconUrl); });
             } else {
                if (skillSet[k].iconUrl) skillSet[k].iconUrl = updateUrl(skillSet[k].iconUrl);
             }
          }
        });
      });
    }
  });

  if (schemaConfig.ooparts) {
    schemaConfig.ooparts.forEach(o => {
      if (o.tiers) {
        o.tiers.forEach(t => {
          t.iconUrl = updateUrl(t.iconUrl);
        });
      }
    });
  }

  if (schemaConfig.equipments) {
    schemaConfig.equipments.forEach(e => {
      if (e.tiers) {
        e.tiers.forEach(t => {
          t.iconUrl = updateUrl(t.iconUrl);
        });
      }
    });
  }

  if (schemaConfig.gifts) {
    schemaConfig.gifts.forEach(g => {
      g.iconUrl = updateUrl(g.iconUrl);
    });
  }

  if (schemaConfig.resourceIcons) {
    schemaConfig.resourceIcons.Credit = updateUrl(schemaConfig.resourceIcons.Credit);
    schemaConfig.resourceIcons.SecretTechSheet = updateUrl(schemaConfig.resourceIcons.SecretTechSheet);
    if (schemaConfig.resourceIcons.Eleph) schemaConfig.resourceIcons.Eleph = updateUrl(schemaConfig.resourceIcons.Eleph);
    if (schemaConfig.resourceIcons.ExpReports) {
      for (let i = 0; i < schemaConfig.resourceIcons.ExpReports.length; i++) {
        schemaConfig.resourceIcons.ExpReports[i] = updateUrl(schemaConfig.resourceIcons.ExpReports[i]);
      }
    }
    ['TechNotes', 'BDs'].forEach(type => {
      if (schemaConfig.resourceIcons[type]) {
        Object.keys(schemaConfig.resourceIcons[type]).forEach(school => {
          const arr = schemaConfig.resourceIcons[type][school];
          for (let i = 0; i < arr.length; i++) {
            arr[i] = updateUrl(arr[i]);
          }
        });
      }
    });
  }
  
  if (updatedCount > 0) {
    saveMasterDB();
    saveSchemaConfig();
  }

  res.json({ success: true, newPath: newRelPath });
});

function updateImageReferences(oldUrl, newUrl) {
  studentMasterDB.forEach(master => {
    if (master.portraitUrls && Array.isArray(master.portraitUrls)) {
      master.portraitUrls = master.portraitUrls.map(url => url === oldUrl ? newUrl : url);
    }
    if (master.favoriteItemUrl === oldUrl) master.favoriteItemUrl = newUrl;
    if (master.skills && Array.isArray(master.skills)) {
      master.skills.forEach(skillSet => {
        ['ex', 'normal', 'passive', 'sub', 'normalPlus', 'passivePlus'].forEach(k => {
          if (skillSet[k]) {
             if (Array.isArray(skillSet[k])) {
                skillSet[k].forEach(s => { if (s && s.iconUrl === oldUrl) s.iconUrl = newUrl; });
             } else {
                if (skillSet[k].iconUrl === oldUrl) skillSet[k].iconUrl = newUrl;
             }
          }
        });
      });
    }
  });

  if (schemaConfig.ooparts) {
    schemaConfig.ooparts.forEach(o => {
      if (o.tiers) {
        o.tiers.forEach(t => {
          if (t.iconUrl === oldUrl) t.iconUrl = newUrl;
        });
      }
    });
  }

  if (schemaConfig.equipments) {
    schemaConfig.equipments.forEach(e => {
      if (e.tiers) {
        e.tiers.forEach(t => {
          if (t.iconUrl === oldUrl) t.iconUrl = newUrl;
        });
      }
    });
  }

  if (schemaConfig.gifts) {
    schemaConfig.gifts.forEach(g => {
      if (g.iconUrl === oldUrl) g.iconUrl = newUrl;
    });
  }

  if (schemaConfig.resourceIcons) {
    if (schemaConfig.resourceIcons.Credit === oldUrl) schemaConfig.resourceIcons.Credit = newUrl;
    if (schemaConfig.resourceIcons.SecretTechSheet === oldUrl) schemaConfig.resourceIcons.SecretTechSheet = newUrl;
    if (schemaConfig.resourceIcons.Eleph === oldUrl) schemaConfig.resourceIcons.Eleph = newUrl;
    
    if (schemaConfig.resourceIcons.ExpReports) {
      for (let i = 0; i < schemaConfig.resourceIcons.ExpReports.length; i++) {
        if (schemaConfig.resourceIcons.ExpReports[i] === oldUrl) schemaConfig.resourceIcons.ExpReports[i] = newUrl;
      }
    }
    
    if (schemaConfig.resourceIcons.TechNotes) {
      Object.keys(schemaConfig.resourceIcons.TechNotes).forEach(school => {
        const arr = schemaConfig.resourceIcons.TechNotes[school];
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] === oldUrl) arr[i] = newUrl;
        }
      });
    }
    if (schemaConfig.resourceIcons.BDs) {
      Object.keys(schemaConfig.resourceIcons.BDs).forEach(school => {
        const arr = schemaConfig.resourceIcons.BDs[school];
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] === oldUrl) arr[i] = newUrl;
        }
      });
    }
  }
  saveMasterDB();
  saveSchemaConfig();
}

/* ═══════════════════════════════════════════════
   마스터 DB & 개인 아카이브 DB (Mock)
   ═══════════════════════════════════════════════ */
const emptySkills = {
  ex: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
  normal: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
  passive: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
  sub: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
  normalPlus: { name: '', descriptionTemplate: '' },
  passivePlus: { name: '', descriptionTemplate: '' }
};

const emptyUniqueWeaponEffects = { star2: '', star3: '', star4: '' };
const emptyFavoriteItemEffects = { t1: '', t2: '' };
const emptyTerrainAffinity = { urban: 'B', outdoor: 'B', indoor: 'B' };

let studentMasterDB = [];
try {
  studentMasterDB = JSON.parse(fs.readFileSync(__dirname + '/data/plana_mapped.json', 'utf8'));
} catch (e) {
  console.log('Failed to load plana_mapped.json, using empty array.', e.message);
}

// Archive data is now stored in Prisma DB, so we no longer need the in-memory personalArchiveDB.

app.get('/api/students/names', (req, res) => {
  res.json(studentMasterDB.map(s => s.name));
});

app.get('/api/archive', optionalAuth, async (req, res) => {
  try {
    const requiredFields = schemaConfig.statFields.filter(f => f.required).map(f => f.key);
    
    // Fetch collections from Prisma instead of memory
    const collections = req.user ? await prisma.collection.findMany({
      where: { userId: req.user.id }
    }) : [];
    
    const userArchiveMap = new Map();
    collections.forEach(c => {
      if (c.details) {
        userArchiveMap.set(c.studentId, { ...c.details, studentId: c.studentId, currentStars: c.starGrade });
      } else {
        userArchiveMap.set(c.studentId, { studentId: c.studentId, currentStars: c.starGrade });
      }
    });

    const result = studentMasterDB.map(master => {
      const archive = userArchiveMap.get(master.id);
      let isMissing = false; let missingMessages = [];
      if (!archive || !archive.stats) { isMissing = true; missingMessages.push('스크린샷 캡쳐(기록)가 없습니다.'); } else {
        const missingKeys = requiredFields.filter(key => archive.stats[key] === null || archive.stats[key] === undefined);
        if (missingKeys.length > 0) {
          isMissing = true;
          const labels = missingKeys.map(k => schemaConfig.statFields.find(f => f.key === k)?.label || k);
          missingMessages.push(`${labels.join(', ')} 수치가 캡쳐되지 않았습니다.`);
        }
      }
      return { master, archive: archive || null, warning: isMissing ? { message: missingMessages.join(' ') } : null };
    });
    result.sort((a, b) => a.master.name.localeCompare(b.master.name, 'ko-KR'));
    res.json({ totalStudents: studentMasterDB.length, archivedCount: collections.length, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch archive' });
  }
});

app.post('/api/master/students', (req, res) => {
  const newStudent = { ...req.body, id: Date.now() };
  if (!newStudent.skills) newStudent.skills = [{ ex: {}, normal: {}, passive: {}, sub: {} }];
  if (!newStudent.portraitUrls) newStudent.portraitUrls = [];
  studentMasterDB.push(newStudent);
  saveMasterDB();
  res.json({ status: 'success', student: newStudent });
});
app.put('/api/master/students/:id', (req, res) => {
  studentMasterDB = studentMasterDB.map(s => s.id === parseInt(req.params.id) ? { ...req.body, id: parseInt(req.params.id) } : s);
  saveMasterDB();
  res.json({ status: 'success' });
});
app.delete('/api/master/students/:id', (req, res) => {
  studentMasterDB = studentMasterDB.filter(s => s.id !== parseInt(req.params.id));
  res.json({ status: 'success' });
});

const { execFile } = require('child_process');

app.post('/api/master/gacha/update', (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }
  
  const scriptPath = path.join(__dirname, '../scripts/update_gacha_from_url.js');
  
  execFile('node', [scriptPath, ...urls], (error, stdout, stderr) => {
    if (error) {
      console.error('execFile error:', error);
      return res.status(500).json({ error: 'Failed to update gacha data', details: stderr || error.message });
    }
    console.log(`Gacha Update stdout: ${stdout}`);
    if (stderr) console.error(`Gacha Update stderr: ${stderr}`);
    
    res.json({ status: 'success', output: stdout });
  });
});

// 가챠 데이터 캐시 (매 요청마다 파일 읽기/파싱 방지)
let gachaCache = null;
let gachaCacheTime = 0;
const GACHA_CACHE_TTL = 30000; // 30초 캐시

app.get('/api/master/gacha/status', (req, res) => {
  try {
    const now = Date.now();
    if (!gachaCache || (now - gachaCacheTime > GACHA_CACHE_TTL)) {
      const dataPath = path.join(__dirname, '../client/src/data/gacha.json');
      if (fs.existsSync(dataPath)) {
        gachaCache = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      } else {
        gachaCache = { urls: [], banners: [], pools: { "3_star": [], "2_star": [], "1_star": [] } };
      }
      gachaCacheTime = now;
    }
    res.json(gachaCache);
  } catch (error) {
    gachaCache = null; // 에러 시 캐시 무효화
    res.status(500).json({ error: 'Failed to read gacha status' });
  }
});


app.listen(port, () => console.log(`Backend Server running at http://localhost:${port}`));

const https = require('https');
try {
  const options = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
  };
  https.createServer(options, app).listen(3443, () => {
    console.log('Secure Backend Server running at https://localhost:3443');
  });
} catch (e) {
  console.log('Failed to start HTTPS server:', e.message);
}



// Trigger restart
