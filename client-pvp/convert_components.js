const fs = require('fs');

const path = './src/components/pvp/PvpPartyCard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/RaidParty/g, 'PvpParty');
content = content.replace(/@\/types\/raid/g, '@/types/pvp');
content = content.replace(/RaidReportModal/g, 'PvpReportModal');
content = content.replace(/api\.post\(`\/raids\/parties\/\$\{party\.id\}\/like/g, 'api.post(`/pvp/parties/${party.id}/like');
content = content.replace(/api\.delete\(`\/raids\/parties\/\$\{party\.id\}/g, 'api.delete(`/pvp/parties/${party.id}');
content = content.replace(/party\.parties/g, 'party.party');
// PvP doesn't have bossId, mode, terrain, clearTime etc. We replace them with deckType
content = content.replace(/party\.clearTime/g, 'undefined'); // Just an easy way to hide it
content = content.replace(/getModeName\(party\.mode\)/g, 'party.deckType === "Attack" ? "공격" : party.deckType === "Defense" ? "방어" : "인/아웃"');
content = content.replace(/party\.mode === 'LimitBreakAssault' \? `\$\{party\.difficulty\}단계` : party\.difficulty/g, '""');
content = content.replace(/getTerrainName\(party\.terrain\)/g, '""');
content = content.replace(/bossName \|\| party\.bossId/g, '""');

// Fix slideshow logic since party is an object, not array
content = content.replace(/party\.party\.length <= 1/g, 'true'); // Disable slideshow
content = content.replace(/p\.name/g, 'undefined'); // inner party name

// Fix formation import for PvP
content = content.replace(/importTeam\(party\.party\[0\]\.strikers, party\.party\[0\]\.specials\)/g, 'importTeam(party.party.strikers, party.party.specials)');
// Update renderPartyView call
content = content.replace(/party\.party\[currentPartyIndex\]/g, 'party.party');

fs.writeFileSync(path, content, 'utf8');
console.log('PvpPartyCard converted.');

const modalPath = './src/components/pvp/PvpReportModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');
modalContent = modalContent.replace(/RaidReportModal/g, 'PvpReportModal');
modalContent = modalContent.replace(/\/raids\/parties/g, '/pvp/parties');
fs.writeFileSync(modalPath, modalContent, 'utf8');
console.log('PvpReportModal converted.');
