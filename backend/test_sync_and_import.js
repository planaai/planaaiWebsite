const assert = require('assert');

// 1. bondRank validation logic test
function parseBondRank(existingBond, inputBond) {
  let bondRank = existingBond;
  if (inputBond !== undefined && inputBond !== null) {
    const parsedBond = parseInt(inputBond, 10);
    if (!isNaN(parsedBond) && parsedBond >= 1 && parsedBond <= 100) {
      bondRank = parsedBond;
    }
  }
  return bondRank;
}

// 2. timestamp merge logic test
function mergeCollectionDetails(existingDetails, incomingItem) {
  if (!existingDetails) return incomingItem;

  const existingTime = existingDetails.capturedAt ? new Date(existingDetails.capturedAt).getTime() : 0;
  const incomingTime = incomingItem.capturedAt ? new Date(incomingItem.capturedAt).getTime() : 0;

  if (existingTime > 0 && incomingTime > 0 && existingTime > incomingTime) {
    // DB is newer -> preserve existing details over older incoming item
    return { ...incomingItem, ...existingDetails };
  } else {
    // Incoming is newer or no valid timestamp comparison -> incoming overrides
    return { ...existingDetails, ...incomingItem };
  }
}

console.log('Testing bondRank validation...');
assert.strictEqual(parseBondRank(undefined, 25), 25, 'Valid number 25 should be accepted');
assert.strictEqual(parseBondRank(undefined, '50'), 50, 'Valid string 50 should be parsed');
assert.strictEqual(parseBondRank(25, 0), 25, '0 should be rejected and keep 25');
assert.strictEqual(parseBondRank(25, 101), 25, '101 should be rejected and keep 25');
assert.strictEqual(parseBondRank(25, -1), 25, '-1 should be rejected and keep 25');
assert.strictEqual(parseBondRank(25, 'invalid'), 25, 'invalid string should be rejected and keep 25');
assert.strictEqual(parseBondRank(25, null), 25, 'null should keep 25');
assert.strictEqual(parseBondRank(25, undefined), 25, 'undefined should keep 25');
assert.strictEqual(parseBondRank(25, 100), 100, '100 should be accepted');
assert.strictEqual(parseBondRank(25, 1), 1, '1 should be accepted');
console.log('✔ All bondRank tests passed.');

console.log('Testing collection merge logic...');
const oldDate = '2026-05-01T00:00:00.000Z';
const newDate = '2026-10-13T00:00:00.000Z';

// Scenario A: DB is newer (macro updated at newDate), incoming is older (web localstorage from oldDate)
const dbDetails = { level: 90, bondRank: 25, capturedAt: newDate };
const webItemOld = { level: 85, bondRank: 10, capturedAt: oldDate, memo: 'web note' };
const mergedA = mergeCollectionDetails(dbDetails, webItemOld);
assert.strictEqual(mergedA.bondRank, 25, 'Newer DB bondRank must be preserved');
assert.strictEqual(mergedA.level, 90, 'Newer DB level must be preserved');
assert.strictEqual(mergedA.memo, 'web note', 'Non-overlapping incoming fields can be preserved');

// Scenario B: Web is newer (user edited on web at newDate), DB is older (oldDate)
const dbDetailsOld = { level: 85, bondRank: 10, capturedAt: oldDate };
const webItemNew = { level: 90, bondRank: 28, capturedAt: newDate };
const mergedB = mergeCollectionDetails(dbDetailsOld, webItemNew);
assert.strictEqual(mergedB.bondRank, 28, 'Newer incoming bondRank must override older DB');
assert.strictEqual(mergedB.level, 90, 'Newer incoming level must override older DB');

console.log('✔ All collection merge tests passed.');
