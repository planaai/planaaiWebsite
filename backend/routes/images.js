const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { uploadDynamic, uploadFolderDynamic, baseDir } = require('../config/multer');
const { updateImageReferences } = require('../utils/imageRefUpdater');
const { requireAdmin } = require('../middleware/auth');

// All file and folder operations require admin privilege
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    return requireAdmin(req, res, next);
  }
  next();
});

function resolveSafePath(base, userPath) {
  if (!userPath || typeof userPath !== 'string') return null;
  let clean = userPath.startsWith('/uploads/') ? userPath.slice(9) : userPath;
  clean = clean.replace(/^[/\\]+/, '');
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(base, clean);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    return null;
  }
  return resolvedTarget;
}

router.post('/upload', uploadDynamic.any(), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  let folder = req.query.folder || 'misc';
  const targetDir = resolveSafePath(baseDir, folder);
  if (!targetDir) return res.status(400).json({ error: 'Invalid folder' });
  
  const relFolder = path.relative(baseDir, targetDir).replace(/\\/g, '/');
  const urls = req.files.map(file => `/uploads/${relFolder ? relFolder + '/' : ''}${file.filename}`);
  res.json({ status: 'success', urls });
});

router.post('/upload_folder', uploadFolderDynamic.any(), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  let folder = req.query.folder || '';
  const uploadDir = resolveSafePath(baseDir, folder);
  if (!uploadDir) return res.status(400).json({ error: 'Invalid folder' });
  
  const paths = req.body.paths;
  const urls = [];
  
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    let relPath = file.originalname;
    if (paths) {
      if (Array.isArray(paths)) {
        relPath = paths[i] || file.originalname;
      } else if (typeof paths === 'string' && req.files.length === 1) {
        relPath = paths;
      }
    }
    
    const destPath = resolveSafePath(uploadDir, relPath);
    if (!destPath) {
      continue;
    }
    const destDir = path.dirname(destPath);
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.renameSync(file.path, destPath);
    
    const relToUploads = path.relative(baseDir, destPath).replace(/\\/g, '/');
    urls.push(`/uploads/${relToUploads}`);
  }
  
  if (req.tempUploadDir) {
    try { fs.rmSync(req.tempUploadDir, { recursive: true, force: true }); } catch (e) {}
  }
  
  res.json({ status: 'success', urls });
});

router.get('/', (req, res) => {
  if (!fs.existsSync(baseDir)) return res.json([]);
  
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
  readDirRecursive(baseDir);
  images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  res.json(images);
});

router.get('/folders', (req, res) => {
  if (!fs.existsSync(baseDir)) return res.json([]);
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
  readDirRecursive(baseDir);
  res.json(folders);
});

router.delete('/file', (req, res) => {
  const urlPath = req.query.path;
  if (!urlPath) return res.status(400).json({ error: 'path required' });
  
  const fullPath = resolveSafePath(baseDir, urlPath);
  if (!fullPath || fullPath === path.resolve(baseDir)) {
    return res.status(400).json({ error: 'Invalid or unsafe path' });
  }
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    fs.unlinkSync(fullPath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

router.post('/files/delete', (req, res) => {
  const { paths } = req.body;
  if (!paths || !Array.isArray(paths)) return res.status(400).json({ error: 'paths array required' });
  
  let deletedCount = 0;
  paths.forEach(urlPath => {
    const fullPath = resolveSafePath(baseDir, urlPath);
    if (fullPath && fullPath !== path.resolve(baseDir) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      deletedCount++;
    }
  });
  
  res.json({ success: true, deletedCount });
});

router.put('/file/rename', (req, res) => {
  const { newName } = req.body;
  const urlPath = req.query.path;
  if (!newName || !urlPath) return res.status(400).json({ error: 'newName and path required' });
  
  const fullPath = resolveSafePath(baseDir, urlPath);
  if (!fullPath || fullPath === path.resolve(baseDir)) {
    return res.status(400).json({ error: 'Invalid or unsafe path' });
  }

  const sanitizedNewName = path.basename(newName);
  if (!sanitizedNewName || sanitizedNewName === '.' || sanitizedNewName.includes('..')) {
    return res.status(400).json({ error: 'Invalid new name' });
  }
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const dir = path.dirname(fullPath);
    const newFullPath = path.join(dir, sanitizedNewName);
    fs.renameSync(fullPath, newFullPath);
    
    const oldUrl = `/uploads/${path.relative(baseDir, fullPath).replace(/\\/g, '/')}`;
    const newUrl = `/uploads/${path.relative(baseDir, newFullPath).replace(/\\/g, '/')}`;
    
    updateImageReferences(oldUrl, newUrl);
    res.json({ success: true, oldUrl, newUrl });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

router.put('/file/move', (req, res) => {
  const { targetFolder } = req.body;
  const urlPath = req.query.path;
  if (targetFolder === undefined || !urlPath) return res.status(400).json({ error: 'targetFolder and path required' });

  const fullPath = resolveSafePath(baseDir, urlPath);
  if (!fullPath || fullPath === path.resolve(baseDir)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  const safeTarget = targetFolder === 'root' || targetFolder === '' ? '' : targetFolder;
  const destDir = resolveSafePath(baseDir, safeTarget);
  if (!destDir) {
    return res.status(400).json({ error: 'Invalid target folder' });
  }

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const filename = path.basename(fullPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    
    const destPath = path.join(destDir, filename);
    if (fullPath !== destPath) {
      fs.renameSync(fullPath, destPath);
    }
    
    const oldUrl = `/uploads/${path.relative(baseDir, fullPath).replace(/\\/g, '/')}`;
    const newUrl = `/uploads/${path.relative(baseDir, destPath).replace(/\\/g, '/')}`;
    
    updateImageReferences(oldUrl, newUrl);
    res.json({ success: true, oldUrl, newUrl });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

router.put('/files/move', (req, res) => {
  const { targetFolder, paths } = req.body;
  if (targetFolder === undefined || !paths || !Array.isArray(paths)) return res.status(400).json({ error: 'targetFolder and paths array required' });

  const safeTarget = targetFolder === 'root' || targetFolder === '' ? '' : targetFolder;
  const destDir = resolveSafePath(baseDir, safeTarget);
  if (!destDir) {
    return res.status(400).json({ error: 'Invalid target folder' });
  }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const movedItems = [];

  paths.forEach(urlPath => {
    const fullPath = resolveSafePath(baseDir, urlPath);
    if (fullPath && fullPath !== path.resolve(baseDir) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const filename = path.basename(fullPath);
      const destPath = path.join(destDir, filename);
      
      if (fullPath !== destPath) {
        fs.renameSync(fullPath, destPath);
        
        const oldUrl = `/uploads/${path.relative(baseDir, fullPath).replace(/\\/g, '/')}`;
        const newUrl = `/uploads/${path.relative(baseDir, destPath).replace(/\\/g, '/')}`;
        
        updateImageReferences(oldUrl, newUrl);
        movedItems.push({ oldUrl, newUrl });
      }
    }
  });

  res.json({ success: true, movedItems });
});

router.post('/folder', (req, res) => {
  const { folderName } = req.body;
  if (!folderName) return res.status(400).json({ error: 'folderName required' });
  const targetPath = resolveSafePath(baseDir, folderName);
  if (!targetPath || targetPath === path.resolve(baseDir)) {
    return res.status(400).json({ error: 'Invalid folder path' });
  }
  if (fs.existsSync(targetPath)) return res.status(400).json({ error: 'Folder already exists' });
  
  fs.mkdirSync(targetPath, { recursive: true });
  res.json({ success: true });
});

router.delete('/folder', (req, res) => {
  const folderPath = req.query.path;
  if (!folderPath) return res.status(400).json({ error: 'path required' });
  const targetPath = resolveSafePath(baseDir, folderPath);
  if (!targetPath || targetPath === path.resolve(baseDir)) {
    return res.status(400).json({ error: 'Cannot delete root or invalid directory' });
  }
  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Folder not found' });
  
  fs.rmSync(targetPath, { recursive: true, force: true });
  res.json({ success: true });
});

router.put('/folder/rename', (req, res) => {
  const { oldPath, newName } = req.body;
  if (!oldPath || !newName) return res.status(400).json({ error: 'oldPath and newName required' });
  
  const targetOldPath = resolveSafePath(baseDir, oldPath);
  if (!targetOldPath || targetOldPath === path.resolve(baseDir)) {
    return res.status(400).json({ error: 'Invalid oldPath' });
  }
  if (!fs.existsSync(targetOldPath)) return res.status(404).json({ error: 'Folder not found' });

  const safeNewName = path.basename(newName);
  if (!safeNewName || safeNewName === '.' || safeNewName.includes('..')) {
    return res.status(400).json({ error: 'Invalid newName' });
  }

  const parentDir = path.dirname(targetOldPath);
  const targetNewPath = path.join(parentDir, safeNewName);
  const checkSafe = resolveSafePath(baseDir, path.relative(baseDir, targetNewPath));
  if (!checkSafe) {
    return res.status(400).json({ error: 'Unsafe new folder path' });
  }
  if (fs.existsSync(targetNewPath)) return res.status(400).json({ error: 'New folder name already exists' });
  
  fs.renameSync(targetOldPath, targetNewPath);
  
  const newRelPath = path.relative(baseDir, targetNewPath).replace(/\\/g, '/');
  const oldRelPath = path.relative(baseDir, targetOldPath).replace(/\\/g, '/');
  
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

  const { getStudentMasterDB, saveMasterDB, getSchemaConfig, saveSchemaConfig } = require('../config/masterDB');
  const studentMasterDB = getStudentMasterDB();
  const schemaConfig = getSchemaConfig();

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

module.exports = router;
