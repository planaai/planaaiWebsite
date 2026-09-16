const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const port = process.env.PORT || 3000;

// Reverse Proxy (Nginx / Cloudflare) Trust
app.set('trust proxy', 1);

const { ipBanMiddleware } = require('./middleware/ipBan');

// 미들웨어 - CORS 설정
const productionOrigins = [
  'https://planaai.kro.kr',
  'https://www.planaai.kro.kr',
  'https://admin.planaai.kro.kr',
  'https://api.planaai.kro.kr',
  'https://planaai-admin.planaai.workers.dev',
  'https://pvp.planaai.kro.kr'
];

const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:3000',
  'https://localhost:5173'
];

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? productionOrigins 
  : [...productionOrigins, ...developmentOrigins];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With', 'Accept', 'X-Device-Fingerprint']
};

app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(hpp());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 전역 IP 밴 미들웨어 (모든 요청에 적용)
app.use(ipBanMiddleware);

const { baseDir } = require('./config/multer');

// 정적 파일 서빙
app.use('/uploads', express.static(baseDir, {
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
const schemaRouter = require('./routes/schema');
const imagesRouter = require('./routes/images');
const masterRouter = require('./routes/master');
const archiveRouter = require('./routes/archive');
const hofRouter = require('./routes/hof');

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
app.use('/api/hof', hofRouter);

// 전역 에러 핸들러 (스택 트레이스 노출 방지)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: '서버 오류가 발생했습니다.'
  });
});

app.listen(port, () => console.log(`Backend Server running at http://localhost:${port}`));

try {
  const options = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
  };
  https.createServer(options, app).listen(3443, () => {
    console.log('Secure Backend Server running at https://localhost:3443');
  });
} catch (e) {
  // HTTPS key/cert may not exist in local development
}

module.exports = app;
