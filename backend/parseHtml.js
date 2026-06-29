const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

const filePath = path.join(__dirname, '../data/블루 아카이브_경험치 테이블 - 나무위키.html');
const html = fs.readFileSync(filePath, 'utf8');
const $ = cheerio.load(html);

const result = {
    equipExp: {},
    equipTier: {},
    weaponExp: {},
    weaponStar: {},
    exSkill: {},
    normalSkill: {}
};

$('table').each((i, table) => {
    // Equipment Level EXP: Table 50
    if (i === 50) {
        $(table).find('tr').each((r, tr) => {
            if (r === 0) return;
            const tds = $(tr).find('td');
            if (tds.length >= 2) {
                const lvText = $(tds[0]).text().trim();
                const exp = parseInt($(tds[1]).text().trim().replace(/,/g, ''));
                const credit = parseInt($(tds[3]).text().trim().replace(/,/g, ''));
                if (lvText.includes('→')) {
                    const toLv = parseInt(lvText.split('→')[1].trim());
                    result.equipExp[toLv] = { exp, credit };
                }
            }
        });
    }
    // Equipment Tier Upgrade: Table 51
    if (i === 51) {
        $(table).find('tr').each((r, tr) => {
            if (r <= 1) return;
            const tds = $(tr).find('td');
            if (tds.length >= 3) {
                const tierText = $(tds[0]).text().trim();
                if (tierText.includes('→')) {
                    const fromTier = parseInt(tierText.split('→')[0].trim().replace('T', ''));
                    const toTier = parseInt(tierText.split('→')[1].trim().replace('T', ''));
                    const bps = {};
                    let bpStartIdx = 1;
                    for (let t = 2; t <= 10; t++) {
                        if (tds[bpStartIdx]) {
                            const val = $(tds[bpStartIdx]).text().trim();
                            if (val && val !== '-') bps[`${t}T`] = parseInt(val);
                            bpStartIdx++;
                        }
                    }
                    const credit = parseInt($(tds[tds.length-2]).text().trim().replace(/,/g, ''));
                    result.equipTier[toTier] = { blueprints: bps, credit };
                }
            }
        });
    }
    // Weapon Level EXP: Table 52
    if (i === 52) {
        $(table).find('tr').each((r, tr) => {
            if (r === 0) return;
            const tds = $(tr).find('td');
            if (tds.length >= 2) {
                const lvText = $(tds[0]).text().trim();
                const exp = parseInt($(tds[1]).text().trim().replace(/,/g, ''));
                const credit = parseInt($(tds[3]).text().trim().replace(/,/g, ''));
                if (lvText.includes('→')) {
                    const toLv = parseInt(lvText.split('→')[1].trim());
                    result.weaponExp[toLv] = { exp, credit };
                }
            }
        });
    }
    // Weapon Star Upgrade: Table 53
    if (i === 53) {
        $(table).find('tr').each((r, tr) => {
            if (r === 0) return;
            const tds = $(tr).find('td');
            if (tds.length >= 3) {
                const starText = $(tds[0]).text().trim();
                if (starText.includes('→')) {
                    const toStar = parseInt(starText.split('→')[1].trim().replace('성', ''));
                    const eleph = parseInt($(tds[1]).text().trim().replace(/,/g, ''));
                    const credit = parseInt($(tds[2]).text().trim().replace(/,/g, ''));
                    result.weaponStar[toStar] = { eleph, credit };
                }
            }
        });
    }
    // EX Skill: Table 48
    if (i === 48) {
        $(table).find('tr').each((r, tr) => {
            if (r === 0) return;
            const tds = $(tr).find('td');
            if (tds.length >= 4) {
                const lvText = $(tds[0]).text().trim();
                if (lvText.includes('레벨')) {
                    const lv = parseInt(lvText.replace('레벨', '').trim());
                    const bds = $(tds[1]).text().trim(); // e.g. 하급×12
                    const ooparts = $(tds[2]).text().trim(); // e.g. 메인 - 하급
                    const credit = parseInt($(tds[tds.length-1]).text().trim().replace(/,/g, ''));
                    result.exSkill[lv] = { bds, ooparts, credit };
                }
            }
        });
    }
    // Normal/Sub Skill: Table 49
    if (i === 49) {
        $(table).find('tr').each((r, tr) => {
            if (r === 0) return;
            const tds = $(tr).find('td');
            if (tds.length >= 4) {
                const lvText = $(tds[0]).text().trim();
                if (lvText.includes('레벨')) {
                    const lv = parseInt(lvText.replace('레벨', '').trim());
                    const techNotes = $(tds[1]).text().trim(); // e.g. 하급×5
                    const ooparts = $(tds[2]).text().trim(); // e.g. 메인 - 하급
                    const credit = parseInt($(tds[tds.length-1]).text().trim().replace(/,/g, ''));
                    result.normalSkill[lv] = { techNotes, ooparts, credit };
                }
            }
        });
    }
});

fs.writeFileSync(path.join(__dirname, 'parsed_html_data.json'), JSON.stringify(result, null, 2));
console.log("Done");
