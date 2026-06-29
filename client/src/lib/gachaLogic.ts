import gachaData from '../data/gacha.json';

interface GachaResult {
  name: string;
  rarity: 1 | 2 | 3;
  isPickup: boolean;
}

export function performSinglePull(bannerIndex: number = 0): GachaResult[] {
  const results: GachaResult[] = [];
  const banner = gachaData.banners[bannerIndex] || gachaData.banners[0];
  const rates = gachaData.rates.normal;

  const roll = Math.random();
  let selectedRarity: 1 | 2 | 3 = 1;

  if (roll < rates["3_star"]) {
    selectedRarity = 3;
  } else if (roll < rates["3_star"] + rates["2_star"]) {
    selectedRarity = 2;
  } else {
    selectedRarity = 1;
  }

  let isPickup = false;
  let selectedName = "";

  if (selectedRarity === 3) {
    const pickupRoll = Math.random();
    const totalPickupRate = banner.pickups.reduce((sum, p) => sum + p.rate, 0);
    const normalizedPickupChance = totalPickupRate / rates["3_star"];

    if (pickupRoll < normalizedPickupChance && banner.pickups.length > 0) {
      isPickup = true;
      selectedName = banner.pickups[0].name;
    } else {
      const pool = gachaData.pools["3_star"];
      selectedName = pool[Math.floor(Math.random() * pool.length)];
    }
  } else if (selectedRarity === 2) {
    const pool = gachaData.pools["2_star"];
    selectedName = pool[Math.floor(Math.random() * pool.length)];
  } else if (selectedRarity === 1) {
    const pool = gachaData.pools["1_star"];
    selectedName = pool[Math.floor(Math.random() * pool.length)];
  }

  results.push({
    name: selectedName,
    rarity: selectedRarity,
    isPickup
  });

  return results;
}

export function performTenPull(bannerIndex: number = 0): GachaResult[] {
  const results: GachaResult[] = [];
  const banner = gachaData.banners[bannerIndex] || gachaData.banners[0]; // Currently active banner

  for (let i = 0; i < 10; i++) {
    const isGuaranteed = i === 9; // 10th pull
    const rates = isGuaranteed ? gachaData.rates.guaranteed : gachaData.rates.normal;

    const roll = Math.random();
    let selectedRarity: 1 | 2 | 3 = 1;

    if (roll < rates["3_star"]) {
      selectedRarity = 3;
    } else if (roll < rates["3_star"] + rates["2_star"]) {
      selectedRarity = 2;
    } else {
      selectedRarity = 1;
    }

    let isPickup = false;
    let selectedName = "";

    if (selectedRarity === 3) {
      // Check if it's a pickup
      const pickupRoll = Math.random();
      const totalPickupRate = banner.pickups.reduce((sum, p) => sum + p.rate, 0);

      // We normalize the pickup roll against the total 3-star rate
      const normalizedPickupChance = totalPickupRate / rates["3_star"];

      if (pickupRoll < normalizedPickupChance && banner.pickups.length > 0) {
        isPickup = true;
        // Simple selection if multiple pickups exist (usually just 1)
        selectedName = banner.pickups[0].name;
      } else {
        const pool = gachaData.pools["3_star"];
        selectedName = pool[Math.floor(Math.random() * pool.length)];
      }
    } else if (selectedRarity === 2) {
      const pool = gachaData.pools["2_star"];
      selectedName = pool[Math.floor(Math.random() * pool.length)];
    } else if (selectedRarity === 1) {
      const pool = gachaData.pools["1_star"];
      selectedName = pool[Math.floor(Math.random() * pool.length)];
    }

    results.push({
      name: selectedName,
      rarity: selectedRarity,
      isPickup
    });
  }

  return results;
}
