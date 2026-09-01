/**
 * update_gacha_from_url.js
 * 
 * Fetches Blue Archive gacha probability tables from Nexon's
 * m.nexon.com/probability pages, parses the HTML, and writes
 * the structured data to backend/data/gacha.json.
 * 
 * Usage (CLI):   node update_gacha_from_url.js <url1> [url2] ...
 * Usage (module): const { updateGachaFromUrls } = require('./update_gacha_from_url');
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GACHA_PATH = path.join(DATA_DIR, 'gacha.json');

/**
 * Fetch HTML from a Nexon probability page.
 */
async function fetchPage(url) {
  // Use native fetch (Node 18+)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/**
 * Extract banner name from the page.
 */
function extractBannerName($) {
  // Banner name is in .navbar .brand span
  const raw = $('.navbar .brand span').first().text().trim();
  return raw || '알 수 없는 배너';
}

/**
 * Parse the probability table from the page HTML.
 * 
 * The table has rows with 9 cells: 3 groups of (name, grade, probability).
 * Header rows have background #F2F2F2 and contain "캐릭터명".
 * Section headers span multiple columns (colspan) and contain "회 모집".
 * 
 * We use the first group (columns 0-2) which represents "1회 모집" / standard rates.
 * The "10회 모집(10회차)" section has guaranteed ★★ minimum but we parse all entries.
 */
function parseGachaTable($) {
  const pools = {
    '3_star': [],
    '2_star': [],
    '1_star': [],
  };

  // Find the main table inside #excelDataList
  const tables = $('#excelDataList table');
  
  // If no dynamic table, look for the Word-style table embedded directly
  const allTables = tables.length > 0 ? tables : $('table');
  
  allTables.each((tableIdx, table) => {
    const rows = $(table).find('tr');
    
    rows.each((rowIdx, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return; // Skip rows with insufficient cells
      
      // Check if this is a header row (contains "캐릭터명" or has colspan)
      const firstCellText = $(cells[0]).text().trim();
      if (firstCellText === '캐릭터명' || firstCellText === '') return;
      
      // Check for section header rows (colspan spans)
      const firstColspan = $(cells[0]).attr('colspan');
      if (firstColspan && parseInt(firstColspan) > 1) return;
      
      // Process first group of 3 cells: (name, grade, probability)
      // We use only the first 3 columns (standard "1회 모집" rates)
      const name = $(cells[0]).text().trim()
        .replace(/\s+/g, '')  // Remove extra whitespace
        .replace(/\u00A0/g, '') // Remove &nbsp;
        .replace(/\u3000/g, ''); // Remove ideographic space
      
      const grade = $(cells[1]).text().trim()
        .replace(/\s+/g, '')
        .replace(/\u00A0/g, '')
        .replace(/\u3000/g, '');
      
      const probText = $(cells[2]).text().trim()
        .replace(/\s+/g, '')
        .replace(/\u00A0/g, '')
        .replace(/\u3000/g, '');
      
      if (!name || !grade || !probText) return;
      if (name === '　' || grade === '　') return; // Skip empty cells (fullwidth space)
      
      // Parse probability (remove % sign)
      const prob = parseFloat(probText.replace('%', ''));
      if (isNaN(prob) || prob <= 0) return;
      
      // Determine star rating
      const starCount = (grade.match(/★/g) || []).length;
      
      const entry = { name, probability: prob };
      
      if (starCount >= 3) {
        // Only add if not duplicate
        if (!pools['3_star'].find(e => e.name === name)) {
          pools['3_star'].push(entry);
        }
      } else if (starCount === 2) {
        if (!pools['2_star'].find(e => e.name === name)) {
          pools['2_star'].push(entry);
        }
      } else if (starCount === 1) {
        if (!pools['1_star'].find(e => e.name === name)) {
          pools['1_star'].push(entry);
        }
      }
    });
  });
  
  return pools;
}

/**
 * Detect pickup students (highest probability in their tier).
 */
function detectPickups(pools) {
  const pickups = [];
  
  if (pools['3_star'].length > 0) {
    // Sort by probability descending
    const sorted = [...pools['3_star']].sort((a, b) => b.probability - a.probability);
    const maxProb = sorted[0].probability;
    
    // Pickup students typically have 0.7% while non-pickup have ~0.02%
    // Pickup threshold: significantly higher than median
    const median = sorted[Math.floor(sorted.length / 2)]?.probability || 0;
    const threshold = median * 5; // Pickup is at least 5x the median
    
    sorted.forEach(s => {
      if (s.probability >= threshold && s.probability >= maxProb * 0.5) {
        pickups.push({ name: s.name, star: 3, probability: s.probability });
      }
    });
  }
  
  return pickups;
}

/**
 * Main: fetch URLs, parse, and write gacha.json.
 */
async function updateGachaFromUrls(urls) {
  if (!urls || urls.length === 0) {
    throw new Error('No URLs provided');
  }

  const banners = [];
  let mergedPools = {
    '3_star': [],
    '2_star': [],
    '1_star': [],
  };

  for (const url of urls) {
    console.log(`Fetching: ${url}`);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    const bannerName = extractBannerName($);
    const pools = parseGachaTable($);
    const pickups = detectPickups(pools);
    
    console.log(`Banner: ${bannerName}`);
    console.log(`  ★★★: ${pools['3_star'].length} students`);
    console.log(`  ★★:  ${pools['2_star'].length} students`);
    console.log(`  ★:   ${pools['1_star'].length} students`);
    console.log(`  Pickups: ${pickups.map(p => p.name).join(', ') || 'none detected'}`);
    
    banners.push({
      name: bannerName,
      url: url,
      pickups: pickups,
      pools: pools,
    });

    // Merge pools (use the latest banner's pool data as the active one)
    // Each banner has its own pool; we store per-banner data
  }

  // For the merged/active pools, use the last banner's pools
  // (or merge if multiple banners share the same pool base)
  if (banners.length === 1) {
    mergedPools = banners[0].pools;
  } else {
    // Merge all banners' pools, keeping unique entries
    // Use highest probability if student appears in multiple banners
    for (const banner of banners) {
      for (const tier of ['3_star', '2_star', '1_star']) {
        for (const entry of banner.pools[tier]) {
          const existing = mergedPools[tier].find(e => e.name === entry.name);
          if (existing) {
            existing.probability = Math.max(existing.probability, entry.probability);
          } else {
            mergedPools[tier].push({ ...entry });
          }
        }
      }
    }
  }

  const result = {
    urls: urls,
    rates: {
      normal: {
        "3_star": 0.03,
        "2_star": 0.185,
        "1_star": 0.785
      },
      guaranteed: {
        "3_star": 0.03,
        "2_star": 0.97,
        "1_star": 0
      }
    },
    banners: banners.map(b => ({
      name: b.name,
      url: b.url,
      pickups: b.pickups,
    })),
    pools: mergedPools,
    updatedAt: new Date().toISOString(),
  };

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(GACHA_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nGacha data written to ${GACHA_PATH}`);
  
  return result;
}

// CLI mode
if (require.main === module) {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('Usage: node update_gacha_from_url.js <url1> [url2] ...');
    process.exit(1);
  }
  
  updateGachaFromUrls(urls)
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { updateGachaFromUrls };
