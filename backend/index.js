const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// 미들웨어
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost:3000',
    'https://localhost:5173',
    'https://planaai.kro.kr',
    'https://www.planaai.kro.kr',
    'https://admin.planaai.kro.kr',
    'https://api.planaai.kro.kr',
    'https://planaai-admin.planaai.workers.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With', 'Accept', 'X-Device-Fingerprint']
};
app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(hpp());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));

// 라우터
const authRouter = require('./routes/auth');
const collectionRouter = require('./routes/collection');
const plannerRouter = require('./routes/planner');
const studentsRouter = require('./routes/students');
const imageOffsetsRouter = require('./routes/imageOffsets');
const importRouter = require('./routes/importRoute');
const noticesRouter = require('./routes/notices');
const inquiriesRouter = require('./routes/inquiries');
const raidsRouter = require('./routes/raids');
const pvpRouter = require('./routes/pvp');

// 새로 분리된 라우터들
const schemaRouter = require('./routes/schema');
const imagesRouter = require('./routes/images');
const masterRouter = require('./routes/master');
const archiveRouter = require('./routes/archive');

const { requireAdmin } = require('./middleware/auth');

// 관리자 인증 미들웨어 일괄 적용 (마스터 DB 수정용 라우트)
app.use((req, res, next) => {
  const adminRoutes = [
    '/api/schema/enums', '/api/schema/ooparts', '/api/schema/equipments', '/api/schema/gifts', '/api/schema/resourceIcons',
    '/api/images/upload', '/api/images/folder', '/api/images/file',
    '/api/master/students', '/api/master/gacha/update'
  ];
  if (req.method !== 'GET' && adminRoutes.some(route => req.path.startsWith(route))) {
    return requireAdmin(req, res, next);
  }
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/collection', collectionRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/import', importRouter);
app.use('/api/students', studentsRouter);
app.use('/api/image-offsets', imageOffsetsRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/raids', raidsRouter);
app.use('/api/pvp', pvpRouter);

app.use('/api/schema', schemaRouter);
app.use('/api/images', imagesRouter);
app.use('/api/master', masterRouter);
app.use('/api/archive', archiveRouter);

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
