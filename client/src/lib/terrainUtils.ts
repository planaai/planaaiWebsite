export function parseTerrainUpgrade(upgradeStr: string | undefined) {
  if (!upgradeStr) return null;
  let terrainKey: 'urban' | 'outdoor' | 'indoor' | null = null;
  if (upgradeStr.includes('시가지')) terrainKey = 'urban';
  else if (upgradeStr.includes('야전')) terrainKey = 'outdoor';
  else if (upgradeStr.includes('실내')) terrainKey = 'indoor';

  if (!terrainKey) return null;

  const rankMatch = upgradeStr.match(/\b(D|C|B|A|S|SS)\b/);
  if (rankMatch) {
    return { terrain: terrainKey, rank: rankMatch[1] };
  }
  return null;
}
