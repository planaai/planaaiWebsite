const { getSchemaConfig, saveSchemaConfig, getStudentMasterDB, saveMasterDB } = require('../config/masterDB');

function updateImageReferences(oldUrl, newUrl) {
  const studentMasterDB = getStudentMasterDB();
  const schemaConfig = getSchemaConfig();

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

module.exports = {
  updateImageReferences
};
