const fs = require('fs');

const path = './src/app/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/RaidParty/g, 'PvpParty');
content = content.replace(/@\/types\/raid/g, '@/types/pvp');
content = content.replace(/RaidPartyCard/g, 'PvpPartyCard');
content = content.replace(/@\/components\/raid\/RaidPartyCard/g, '@/components/pvp/PvpPartyCard');
content = content.replace(/api\.get\(`\/raids\/parties/g, 'api.get(`/pvp/parties');
content = content.replace(/총력전\/대결전/g, 'PvP 조합');
content = content.replace(/raids\/write/g, 'pvp/write');
// We need to replace the complicated Raid filter with a simple PvP filter (Attack, Defense, In/Out)
// We will just do some basic replacements for now.

fs.writeFileSync(path, content, 'utf8');
console.log('Main page converted.');
