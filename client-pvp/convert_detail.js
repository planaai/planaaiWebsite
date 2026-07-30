const fs = require('fs');

const path = './src/app/pvp/[code]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/RaidParty/g, 'PvpParty');
content = content.replace(/@\/types\/raid/g, '@/types/pvp');
content = content.replace(/RaidPartyCard/g, 'PvpPartyCard');
content = content.replace(/@\/components\/raid\/RaidPartyCard/g, '@/components/pvp/PvpPartyCard');
content = content.replace(/api\.get\(`\/raids\/parties\/code/g, 'api.get(`/pvp/parties/code');
content = content.replace(/api\.delete\(`\/raids\/parties/g, 'api.delete(`/pvp/parties');
content = content.replace(/총력전\/대결전 조합 상세/g, 'PvP 조합 상세');
content = content.replace(/router\.push\('\/raids'\)/g, 'router.push(\'/\')'); // Go to PvP home on delete

fs.writeFileSync(path, content, 'utf8');
console.log('Detail page converted.');
