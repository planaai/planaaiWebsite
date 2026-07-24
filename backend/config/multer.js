const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB

// 기본 디렉토리 설정
const baseDir = path.join(__dirname, '..', 'uploads');
const skillsDir = path.join(baseDir, 'skills');
const portraitsDir = path.join(baseDir, 'portraits');
const illustsDir = path.join(baseDir, 'illusts');
const miscDir = path.join(baseDir, 'misc');

[skillsDir, portraitsDir, illustsDir, miscDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const createDiskStorage = (destDir, prefix) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, destDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadSkill = multer({ storage: createDiskStorage(skillsDir, 'skill'), limits: { fileSize: FILE_SIZE_LIMIT } });
const uploadPortrait = multer({ storage: createDiskStorage(portraitsDir, 'portrait'), limits: { fileSize: FILE_SIZE_LIMIT } });
const uploadIllust = multer({ storage: createDiskStorage(illustsDir, 'illust'), limits: { fileSize: FILE_SIZE_LIMIT } });

const dynamicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = req.query.folder || 'misc';
    folder = folder.replace(/\.\./g, '');
    const destDir = path.join(baseDir, folder);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadDynamic = multer({ storage: dynamicStorage, limits: { fileSize: FILE_SIZE_LIMIT } });

const folderUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.tempUploadDir) {
      req.tempUploadDir = path.join(os.tmpdir(), 'plana_upload_' + Date.now() + Math.random().toString().slice(2,8));
      fs.mkdirSync(req.tempUploadDir, { recursive: true });
    }
    cb(null, req.tempUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const uploadFolderDynamic = multer({ storage: folderUploadStorage, limits: { fileSize: FILE_SIZE_LIMIT } });

module.exports = {
  uploadSkill,
  uploadPortrait,
  uploadIllust,
  uploadDynamic,
  uploadFolderDynamic,
  baseDir
};
