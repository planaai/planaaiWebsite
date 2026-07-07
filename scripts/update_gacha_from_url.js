const fs = require('fs');
const path = require('path');
const https = require('https');
const cheerio = require(path.join(__dirname, '../backend/node_modules/cheerio'));

const args = process.argv.slice(2);
const urls = args;

if (urls.length === 0) {
    console.error("No urls provided.");
    process.exit(1);
}

const gachaJsonPath = path.join(__dirname, '../client/src/data/gacha.json');
let gachaData;
try {
    gachaData = JSON.parse(fs.readFileSync(gachaJsonPath, 'utf8'));
} catch (e) {
    console.error("Failed to read gacha.json:", e);
    process.exit(1);
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

async function updateGacha() {
    try {
        const banners = [];
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            let html;
            try {
                html = await fetchUrl(url);
            } catch (err) {
                console.error(`Failed to fetch url: ${url}`, err);
                continue;
            }
            const $ = cheerio.load(html);
            
            const title = $('.navbar-brand.brand.bolt-ellipsis span').text().trim();
            if (!title) {
                console.error(`Could not find title for url: ${url}`);
                continue;
            }
            
            let charName = title.replace(' 픽업 모집', '').replace(' 복각', '').trim();
            
            banners.push({
                id: `pickup_${i}`,
                name: title,
                pickups: [
                    {
                        name: charName,
                        rarity: 3,
                        rate: 0.007
                    }
                ]
            });
        }
        
        gachaData.urls = urls;
        gachaData.banners = banners;
        
        banners.forEach(banner => {
            if (banner.name.includes('앙코르 모집')) return;
            banner.pickups.forEach(p => {
                if (p.rarity === 3 && !gachaData.pools["3_star"].includes(p.name)) {
                    gachaData.pools["3_star"].unshift(p.name);
                }
            });
        });
        
        fs.writeFileSync(gachaJsonPath, JSON.stringify(gachaData, null, 2));
        console.log("Successfully updated gacha.json");
    } catch (e) {
        console.error("Error fetching/updating:", e);
        process.exit(1);
    }
}

updateGacha();
